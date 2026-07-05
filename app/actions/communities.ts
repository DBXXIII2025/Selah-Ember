"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotification } from "@/lib/notifications/service";
import {
  getCurrentProfile as getCanonicalCurrentProfile,
  getCurrentProfileForUser as resolveCurrentProfileForUser,
  getOptionalAuthAndProfile,
} from "@/lib/auth/current";
import { canCreateCommunity, canManageCommunity, isCommunityMember, isCommunityOwner } from "@/lib/auth/ownership";
import { assertNotBanned } from "@/lib/moderation/bans";
import { createAdminClient } from "@/lib/supabase/admin";
import { getErrorMetadata } from "@/lib/observability/log";
import { logRequestEvent } from "@/lib/observability/request";

export type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  banner_url: string | null;
  created_by: string | null;
  is_published: boolean;
  member_count: number;
};

export type CommunityMembership = {
  role: string;
  community: Community;
};

export type CommunityMembershipStatus = {
  isSignedIn: boolean;
  isMember: boolean;
  isOwner: boolean;
  role: string | null;
};

export type PublicCommunityDiscovery = {
  communities: Community[];
  isUnavailable: boolean;
};

export type CommunityViewerState = {
  isSignedIn: boolean;
  authUserId: string | null;
  profileId: string | null;
  isOwner: boolean;
  isMember: boolean;
  role: string | null;
};

type Profile = {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
};

export type CommunityCreationAccess = {
  role: string;
  canCreate: boolean;
  createsDraft: boolean;
  message: string | null;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  return value.length > 0 ? value : null;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "community"
  );
}

async function getOptionalProfile(): Promise<Profile | null> {
  const result = await getOptionalAuthAndProfile();
  return result?.profile || null;
}

export async function getCurrentProfileForUser(
  user: { id: string; user_metadata: Record<string, unknown>; email?: string | null } | null,
) {
  if (!user) {
    return null;
  }

  return resolveCurrentProfileForUser(user as Parameters<typeof resolveCurrentProfileForUser>[0]);
}

export async function getCommunityViewerState(communityId: string): Promise<CommunityViewerState> {
  const profile = await getOptionalProfile();

  if (!profile) {
    return {
      isSignedIn: false,
      authUserId: null,
      profileId: null,
      isOwner: false,
      isMember: false,
      role: null,
    };
  }

  const admin = createAdminClient();
  const [{ data: membership, error: membershipError }, owner, member] = await Promise.all([
    admin
      .from("church_memberships")
      .select("role")
      .eq("church_id", communityId)
      .eq("profile_id", profile.id)
      .maybeSingle(),
    isCommunityOwner(communityId, { profile }),
    isCommunityMember(communityId, { profile }),
  ]);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const role = owner ? "owner" : typeof membership?.role === "string" ? membership.role : null;

  return {
    isSignedIn: true,
    authUserId: profile.user_id,
    profileId: profile.id,
    isOwner: owner,
    isMember: member || Boolean(role),
    role,
  };
}

async function getMembershipCounts(communityIds: string[]) {
  if (communityIds.length === 0) {
    return new Map<string, number>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("church_memberships")
    .select("church_id")
    .in("church_id", communityIds);

  if (error) {
    throw new Error(error.message);
  }

  const counts = new Map<string, number>();

  for (const membership of data || []) {
    const churchId = typeof membership.church_id === "string" ? membership.church_id : "";

    if (churchId) {
      counts.set(churchId, (counts.get(churchId) || 0) + 1);
    }
  }

  return counts;
}

function normalizeCommunity(row: Record<string, unknown>, memberCount = 0): Community {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: typeof row.description === "string" ? row.description : null,
    location: typeof row.location === "string" ? row.location : null,
    banner_url: typeof row.banner_url === "string" ? row.banner_url : null,
    created_by: typeof row.created_by === "string" ? row.created_by : null,
    is_published: row.is_published !== false,
    member_count: memberCount,
  };
}

async function getAvailableSlug(name: string) {
  const admin = createAdminClient();
  const baseSlug = slugify(name);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await admin.from("churches").select("id").eq("slug", slug).maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return slug;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function createCommunity(formData: FormData) {
  const name = getFormString(formData, "name");

  if (!name) {
    redirect("/community?message=Selah Ember now uses one open community.");
  }

  const profile = await getCanonicalCurrentProfile();
  await assertNotBanned(profile.user_id);

  const isPlatformEngineer = profile.role === "platform_engineer";

  if (!canCreateCommunity(profile)) {
    redirect("/community?message=Selah Ember now uses one open community. You can post in the community feed or create a group.");
  }

  const admin = createAdminClient();
  const slug = await getAvailableSlug(name);
  const isPublished = isPlatformEngineer;

  const { data: community, error } = await admin
    .from("churches")
    .insert({
      name,
      slug,
      description: nullableFormString(formData, "description"),
      location: nullableFormString(formData, "location"),
      banner_url: nullableFormString(formData, "banner_url"),
      created_by: profile.id,
      is_published: isPublished,
    })
    .select("id,name,slug,description,location,banner_url,created_by")
    .single();

  if (error) {
    redirect(`/community?message=${encodeURIComponent(error.message)}`);
  }

  await admin.from("church_memberships").upsert(
    {
      church_id: community.id,
      profile_id: profile.id,
      role: "owner",
    },
    {
      onConflict: "church_id,profile_id",
    },
  );

  revalidatePath("/communities");
  revalidatePath(`/c/${community.slug}`);
  revalidatePath("/leader");
  redirect(isPublished ? "/communities" : "/community");
}

export async function getCurrentUserCommunities(): Promise<CommunityMembership[]> {
  const profile = await getCanonicalCurrentProfile();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("church_memberships")
    .select(
      "role, churches:church_id(id,name,slug,description,location,banner_url,created_by,is_published)",
    )
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data || []) as unknown as Record<string, unknown>[]).filter(
    (membership) => membership.churches,
  );
  const communityIds = rows
    .map((membership) => (membership.churches as Record<string, unknown>).id)
    .filter((id): id is string => typeof id === "string");
  const counts = await getMembershipCounts(communityIds);

  return rows.map((membership) => {
    const community = membership.churches as Record<string, unknown>;

    return {
      role: typeof membership.role === "string" ? membership.role : "member",
      community: normalizeCommunity(community, counts.get(String(community.id)) || 0),
    };
  });
}

export async function getPublicCommunityBySlug(slug: string): Promise<Community | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("churches")
    .select("id,name,slug,description,location,banner_url,created_by")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const counts = await getMembershipCounts([data.id]);

  return normalizeCommunity(data as unknown as Record<string, unknown>, counts.get(data.id) || 0);
}

export async function getDiscoverCommunities(): Promise<Community[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("churches")
    .select("id,name,slug,description,location,banner_url,created_by")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as unknown as Record<string, unknown>[];
  const communityIds = rows
    .map((community) => community.id)
    .filter((id): id is string => typeof id === "string");
  const counts = await getMembershipCounts(communityIds);

  return rows.map((community) =>
    normalizeCommunity(community, counts.get(String(community.id)) || 0),
  );
}

export async function getDiscoverCommunitiesForPublicPage(): Promise<PublicCommunityDiscovery> {
  try {
    return {
      communities: await getDiscoverCommunities(),
      isUnavailable: false,
    };
  } catch (error) {
    await logRequestEvent("warn", "supabase.public_communities.unavailable", {
      provider: "supabase",
      operation: "read_public_communities",
      ...getErrorMetadata(error),
    });

    return {
      communities: [],
      isUnavailable: true,
    };
  }
}

export async function getCommunityMembershipStatus(
  communityId: string,
): Promise<CommunityMembershipStatus> {
  const viewer = await getCommunityViewerState(communityId);

  return {
    isSignedIn: viewer.isSignedIn,
    isMember: viewer.isMember,
    isOwner: viewer.isOwner,
    role: viewer.role,
  };
}

export async function getCommunityCreationAccess(): Promise<CommunityCreationAccess> {
  const profile = await getCanonicalCurrentProfile();
  const role = profile.role || "user";

  if (role === "platform_engineer") {
    return { role, canCreate: true, createsDraft: false, message: null };
  }

  return {
    role,
    canCreate: false,
    createsDraft: false,
    message: "Selah Ember now uses one open community. You can post in the community feed or create a Bible study group.",
  };
}

export async function joinCommunity(formData: FormData) {
  const communityId = getFormString(formData, "community_id");
  const slug = getFormString(formData, "slug");

  if (!communityId || !slug) {
    redirect("/discover");
  }

  const profile = await getOptionalProfile();

  if (!profile) {
    redirect("/signin");
  }

  await assertNotBanned(profile.user_id);

  const admin = createAdminClient();
  const { data: existingMembership, error: existingMembershipError } = await admin
    .from("church_memberships")
    .select("id")
    .eq("church_id", communityId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (existingMembershipError) {
    redirect(`/c/${slug}?message=${encodeURIComponent(existingMembershipError.message)}`);
  }

  const { error } = await admin.from("church_memberships").upsert(
    {
      church_id: communityId,
      profile_id: profile.id,
      role: "member",
    },
    {
      onConflict: "church_id,profile_id",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    redirect(`/c/${slug}?message=${encodeURIComponent(error.message)}`);
  }

  if (!existingMembership) {
    const { data: ownerMemberships, error: ownerError } = await admin
      .from("church_memberships")
      .select("profiles:profile_id(user_id)")
      .eq("church_id", communityId)
      .eq("role", "owner");

    if (ownerError) {
      throw new Error(ownerError.message);
    }

    await Promise.all(
      ((ownerMemberships || []) as unknown as Record<string, unknown>[]).map((membership) => {
        const ownerProfile = membership.profiles as { user_id?: string } | null | undefined;
        return createNotification({
          userId: ownerProfile?.user_id,
          actorUserId: profile.user_id,
          type: "community_joined",
          title: "Community joined",
          body: "Someone joined your community.",
          href: `/leader/communities/${communityId}`,
        });
      }),
    );
  }

  revalidatePath("/discover");
  revalidatePath("/communities");
  revalidatePath(`/c/${slug}`);
  revalidatePath(`/communities/${communityId}/discussions`);
  revalidatePath(`/communities/${communityId}/discussions/new`);
  redirect(`/c/${slug}`);
}

export async function leaveCommunity(formData: FormData) {
  const communityId = getFormString(formData, "community_id");
  const slug = getFormString(formData, "slug");

  if (!communityId || !slug) {
    redirect("/communities");
  }

  const profile = await getCanonicalCurrentProfile();
  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("church_memberships")
    .select("role")
    .eq("church_id", communityId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (membershipError) {
    redirect(`/c/${slug}?message=${encodeURIComponent(membershipError.message)}`);
  }

  if (!membership) {
    redirect(`/c/${slug}`);
  }

  if (membership.role === "owner") {
    redirect(`/c/${slug}?message=Community owners cannot leave their own community.`);
  }

  const { error } = await admin
    .from("church_memberships")
    .delete()
    .eq("church_id", communityId)
    .eq("profile_id", profile.id)
    .neq("role", "owner");

  if (error) {
    redirect(`/c/${slug}?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/discover");
  revalidatePath("/communities");
  revalidatePath(`/c/${slug}`);
  revalidatePath(`/communities/${communityId}/discussions`);
  revalidatePath(`/communities/${communityId}/discussions/new`);
  redirect(`/c/${slug}`);
}

export async function deleteOwnedCommunity(formData: FormData) {
  const communityId = getFormString(formData, "community_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!communityId) {
    redirect("/communities?message=Community not found.");
  }

  if (confirmation !== "DELETE") {
    redirect(`/communities/${communityId}?message=Type DELETE to confirm community deletion.`);
  }

  const profile = await getCanonicalCurrentProfile();
  const admin = createAdminClient();
  const { data: community, error } = await admin
    .from("churches")
    .select("id,slug,created_by")
    .eq("id", communityId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!community) {
    redirect("/communities?message=Community not found.");
  }

  if (!(await canManageCommunity(communityId, { profile }))) {
    redirect(`/communities/${communityId}?message=You can only delete communities you own.`);
  }

  const { error: deleteError } = await admin.from("churches").delete().eq("id", communityId);

  if (deleteError) {
    redirect(`/communities/${communityId}?message=${encodeURIComponent(deleteError.message)}`);
  }

  revalidatePath("/communities");
  revalidatePath("/discover");
  if (typeof community.slug === "string" && community.slug) {
    revalidatePath(`/c/${community.slug}`);
  }
  redirect("/communities?message=Community deleted.");
}
