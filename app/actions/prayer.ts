"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotification } from "@/app/actions/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PrayerRequest = {
  id: string;
  title: string;
  content: string | null;
  is_private: boolean;
  created_at: string;
  profile_id: string | null;
  community_id: string | null;
  community_name: string | null;
  is_owner: boolean;
};

export type PrayerCommunityOption = {
  id: string;
  name: string;
};

type Profile = {
  id: string;
  user_id: string;
  display_name: string;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  return value.length > 0 ? value : null;
}

async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  return user;
}

async function getCurrentProfile(): Promise<Profile> {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const displayName =
    typeof user.user_metadata.display_name === "string"
      ? user.user_metadata.display_name
      : user.email?.split("@")[0] || "Selah Ember Member";

  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      user_id: user.id,
      display_name: displayName,
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: true,
    },
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id,user_id,display_name")
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function hasColumn(table: string, column: string) {
  const admin = createAdminClient();
  const { error } = await admin.from(table).select(column).limit(1);
  return !error;
}

export async function getPrayerCommunityOptions(): Promise<PrayerCommunityOption[]> {
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("church_memberships")
    .select("churches:church_id(id,name)")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || [])
    .filter((membership) => membership.churches)
    .map((membership) => membership.churches as unknown as PrayerCommunityOption);
}

export async function createPrayerRequest(formData: FormData) {
  const title = getFormString(formData, "title");
  const content = getFormString(formData, "content");

  if (!title || !content) {
    redirect("/prayer/new?message=Title and content are required.");
  }

  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const supportsContent = await hasColumn("prayer_requests", "content");
  const supportsCommunity = await hasColumn("prayer_requests", "community_id");
  const communityId = supportsCommunity ? nullableFormString(formData, "community_id") : null;
  const payload: Record<string, string | boolean | null> = {
    profile_id: profile.id,
    title,
    body: content,
    is_private: formData.get("is_private") === "on",
  };

  if (supportsContent) {
    payload.content = content;
  }

  if (supportsCommunity) {
    payload.community_id = communityId;
  }

  const { data: prayerRequest, error } = await admin
    .from("prayer_requests")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    redirect(`/prayer/new?message=${encodeURIComponent(error.message)}`);
  }

  if (communityId && !payload.is_private) {
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
          type: "community_prayer_request",
          title: "New community prayer request",
          body: "A public prayer request was shared in your community.",
          href: `/prayer${prayerRequest?.id ? `#${prayerRequest.id}` : ""}`,
        });
      }),
    );
  }

  revalidatePath("/prayer");
  redirect("/prayer");
}

export async function getVisiblePrayerRequests(): Promise<PrayerRequest[]> {
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const supportsContent = await hasColumn("prayer_requests", "content");
  const supportsCommunity = await hasColumn("prayer_requests", "community_id");
  const select = supportsCommunity
    ? "id,title,body,content,is_private,created_at,profile_id,community_id,churches:community_id(name)"
    : "id,title,body,is_private,created_at,profile_id";

  const { data, error } = await admin
    .from("prayer_requests")
    .select(select)
    .or(`is_private.eq.false,profile_id.eq.${profile.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as unknown as Record<string, unknown>[];

  return rows.map((row) => {
    const community = row.churches as { name?: string } | null | undefined;
    const content = supportsContent ? row.content : row.body;

    return {
      id: String(row.id),
      title: String(row.title),
      content: typeof content === "string" ? content : null,
      is_private: Boolean(row.is_private),
      created_at: String(row.created_at),
      profile_id: typeof row.profile_id === "string" ? row.profile_id : null,
      community_id: typeof row.community_id === "string" ? row.community_id : null,
      community_name: community?.name || null,
      is_owner: row.profile_id === profile.id,
    };
  });
}
