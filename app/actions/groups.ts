"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotification } from "@/app/actions/notifications";
import {
  getCurrentProfile as getCanonicalCurrentProfile,
  getCurrentProfileForUser as resolveCurrentProfileForUser,
  getOptionalAuthAndProfile,
} from "@/lib/auth/current";
import { canManageGroup, isGroupMember, isGroupOwner } from "@/lib/auth/ownership";
import { assertNotBanned } from "@/lib/moderation/bans";
import { createAdminClient } from "@/lib/supabase/admin";

export type StudyGroup = {
  id: string;
  title: string;
  description: string | null;
  meeting_time: string | null;
  location: string | null;
  community_id: string | null;
  community_name: string | null;
  role: string | null;
  created_by: string | null;
  member_count: number;
};

export type GroupCommunityOption = {
  id: string;
  name: string;
};

export type PublicStudyGroupDiscovery = {
  groups: StudyGroup[];
  isUnavailable: boolean;
};

type Profile = {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
};

export type GroupMembershipStatus = {
  isSignedIn: boolean;
  isMember: boolean;
  isOwner: boolean;
  role: string | null;
};

export type GroupViewerState = {
  isSignedIn: boolean;
  authUserId: string | null;
  profileId: string | null;
  isOwner: boolean;
  isMember: boolean;
  role: string | null;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  return value.length > 0 ? value : null;
}

async function getCurrentProfile(): Promise<Profile> {
  return getCanonicalCurrentProfile();
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

export async function getGroupViewerState(groupId: string): Promise<GroupViewerState> {
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
      .from("group_memberships")
      .select("role")
      .eq("group_id", groupId)
      .eq("profile_id", profile.id)
      .maybeSingle(),
    isGroupOwner(groupId, { profile }),
    isGroupMember(groupId, { profile }),
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

async function hasColumn(table: string, column: string) {
  const admin = createAdminClient();
  const { error } = await admin.from(table).select(column).limit(1);
  return !error;
}

export async function getGroupCommunityOptions(): Promise<GroupCommunityOption[]> {
  const profile = await getCurrentProfile();
  await assertNotBanned(profile.user_id);
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
    .map((membership) => membership.churches as unknown as GroupCommunityOption);
}

export async function createStudyGroup(formData: FormData) {
  const title = getFormString(formData, "title");

  if (!title) {
    redirect("/groups/new?message=Group title is required.");
  }

  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const supportsTitle = await hasColumn("study_groups", "title");
  const supportsMeetingTime = await hasColumn("study_groups", "meeting_time");
  const supportsLocation = await hasColumn("study_groups", "location");
  const supportsCommunityId = await hasColumn("study_groups", "community_id");
  const communityId = nullableFormString(formData, "community_id");
  const meetingTime = nullableFormString(formData, "meeting_time");
  const payload: Record<string, string | boolean | null> = {
    name: title,
    description: nullableFormString(formData, "description"),
    meeting_schedule: meetingTime,
    church_id: communityId,
    created_by: profile.id,
  };

  if (supportsTitle) {
    payload.title = title;
  }

  if (supportsMeetingTime) {
    payload.meeting_time = meetingTime;
  }

  if (supportsLocation) {
    payload.location = nullableFormString(formData, "location");
  }

  if (supportsCommunityId) {
    payload.community_id = communityId;
  }

  const { data: group, error } = await admin
    .from("study_groups")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    redirect(`/groups/new?message=${encodeURIComponent(error.message)}`);
  }

  await admin.from("group_memberships").upsert(
    {
      group_id: group.id,
      profile_id: profile.id,
      role: "owner",
    },
    {
      onConflict: "group_id,profile_id",
    },
  );

  revalidatePath("/groups");
  revalidatePath("/discover/groups");
  redirect("/groups");
}

async function getGroupMembershipCounts(groupIds: string[]) {
  if (groupIds.length === 0) {
    return new Map<string, number>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("group_memberships")
    .select("group_id")
    .in("group_id", groupIds);

  if (error) {
    throw new Error(error.message);
  }

  const counts = new Map<string, number>();

  for (const membership of data || []) {
    const groupId = typeof membership.group_id === "string" ? membership.group_id : "";

    if (groupId) {
      counts.set(groupId, (counts.get(groupId) || 0) + 1);
    }
  }

  return counts;
}

function normalizeGroup(
  row: Record<string, unknown>,
  role: string | null,
  memberCount = 0,
): StudyGroup {
  const community = row.churches as { name?: string } | null | undefined;

  return {
    id: String(row.id),
    title: typeof row.title === "string" ? row.title : String(row.name || ""),
    description: typeof row.description === "string" ? row.description : null,
    meeting_time:
      typeof row.meeting_time === "string"
        ? row.meeting_time
        : typeof row.meeting_schedule === "string"
          ? row.meeting_schedule
          : null,
    location: typeof row.location === "string" ? row.location : null,
    community_id:
      typeof row.community_id === "string"
        ? row.community_id
        : typeof row.church_id === "string"
          ? row.church_id
          : null,
    community_name: community?.name || null,
    role,
    created_by: typeof row.created_by === "string" ? row.created_by : null,
    member_count: memberCount,
  };
}

function groupSelect(supportsPhase5Columns: boolean) {
  return supportsPhase5Columns
    ? "id,title,name,description,meeting_time,meeting_schedule,location,community_id,church_id,created_by,is_public,churches:community_id(name)"
    : "id,name,description,meeting_schedule,church_id,created_by,churches:church_id(name)";
}

export async function getCurrentUserStudyGroups(): Promise<StudyGroup[]> {
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const supportsPhase5Columns = await hasColumn("study_groups", "title");
  const { data, error } = await admin
    .from("group_memberships")
    .select(`role, study_groups:group_id(${groupSelect(supportsPhase5Columns)})`)
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data || []) as unknown as Record<string, unknown>[]).filter(
    (membership) => membership.study_groups,
  );
  const groupIds = rows
    .map((membership) => (membership.study_groups as Record<string, unknown>).id)
    .filter((id): id is string => typeof id === "string");
  const counts = await getGroupMembershipCounts(groupIds);

  return rows.map((membership) => {
    const group = membership.study_groups as Record<string, unknown>;

    return normalizeGroup(
      group,
      typeof membership.role === "string" ? membership.role : null,
      counts.get(String(group.id)) || 0,
    );
  });
}

export async function getStudyGroupById(id: string): Promise<StudyGroup | null> {
  const profile = await getOptionalProfile();
  const admin = createAdminClient();
  const supportsPhase5Columns = await hasColumn("study_groups", "title");
  let role: string | null = null;
  let createdBy: string | null = null;

  if (profile) {
    const { data: membership, error: membershipError } = await admin
      .from("group_memberships")
      .select("role")
      .eq("group_id", id)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    role = typeof membership?.role === "string" ? membership.role : null;
  }

  const { data, error } = await admin
    .from("study_groups")
    .select(groupSelect(supportsPhase5Columns))
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as Record<string, unknown>;
  createdBy = typeof row.created_by === "string" ? row.created_by : null;
  const isOwnerByCreatedBy = Boolean(profile && createdBy && profile.id === createdBy);

  if (isOwnerByCreatedBy) {
    role = "owner";
  }

  if (!role && row.is_public === false) {
    return null;
  }

  const counts = await getGroupMembershipCounts([id]);

  return normalizeGroup(row, role, counts.get(id) || 0);
}

export async function getDiscoverStudyGroups(): Promise<StudyGroup[]> {
  const admin = createAdminClient();
  const supportsPhase5Columns = await hasColumn("study_groups", "title");
  const { data, error } = await admin
    .from("study_groups")
    .select(groupSelect(supportsPhase5Columns))
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as unknown as Record<string, unknown>[];
  const groupIds = rows
    .map((group) => group.id)
    .filter((id): id is string => typeof id === "string");
  const counts = await getGroupMembershipCounts(groupIds);

  return rows.map((group) => normalizeGroup(group, null, counts.get(String(group.id)) || 0));
}

export async function getDiscoverStudyGroupsForPublicPage(): Promise<PublicStudyGroupDiscovery> {
  try {
    return {
      groups: await getDiscoverStudyGroups(),
      isUnavailable: false,
    };
  } catch (error) {
    console.warn("[groups] public_discovery_unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });

    return {
      groups: [],
      isUnavailable: true,
    };
  }
}

export async function getMembershipStatus(groupId: string): Promise<GroupMembershipStatus> {
  const viewer = await getGroupViewerState(groupId);

  return {
    isSignedIn: viewer.isSignedIn,
    isMember: viewer.isMember,
    isOwner: viewer.isOwner || viewer.role === "leader",
    role: viewer.role,
  };
}

export async function joinGroup(formData: FormData) {
  const groupId = getFormString(formData, "group_id");

  if (!groupId) {
    redirect("/discover/groups");
  }

  const profile = await getOptionalProfile();

  if (!profile) {
    redirect("/signin");
  }

  await assertNotBanned(profile.user_id);

  const admin = createAdminClient();
  const { data: existingMembership, error: existingMembershipError } = await admin
    .from("group_memberships")
    .select("id")
    .eq("group_id", groupId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (existingMembershipError) {
    redirect(`/groups/${groupId}?message=${encodeURIComponent(existingMembershipError.message)}`);
  }

  const { error } = await admin.from("group_memberships").upsert(
    {
      group_id: groupId,
      profile_id: profile.id,
      role: "member",
    },
    {
      onConflict: "group_id,profile_id",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    redirect(`/groups/${groupId}?message=${encodeURIComponent(error.message)}`);
  }

  const { data: confirmedMembership, error: confirmedMembershipError } = await admin
    .from("group_memberships")
    .select("id,group_id,profile_id,role")
    .eq("group_id", groupId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (confirmedMembershipError) {
    redirect(`/groups/${groupId}?message=${encodeURIComponent(confirmedMembershipError.message)}`);
  }

  if (!confirmedMembership) {
    redirect(
      `/groups/${groupId}?message=${encodeURIComponent("We could not confirm your group membership. Please try joining again.")}`,
    );
  }

  if (!existingMembership) {
    const { data: group, error: groupError } = await admin
      .from("study_groups")
      .select("title,name")
      .eq("id", groupId)
      .maybeSingle();

    if (groupError) {
      throw new Error(groupError.message);
    }

    const groupTitle =
      typeof group?.title === "string" ? group.title : typeof group?.name === "string" ? group.name : "your group";
    const { data: ownerMemberships, error: ownerError } = await admin
      .from("group_memberships")
      .select("profiles:profile_id(user_id)")
      .eq("group_id", groupId)
      .in("role", ["owner", "leader"]);

    if (ownerError) {
      throw new Error(ownerError.message);
    }

    await Promise.all(
      ((ownerMemberships || []) as unknown as Record<string, unknown>[]).map((membership) => {
        const ownerProfile = membership.profiles as { user_id?: string } | null | undefined;
        return createNotification({
          userId: ownerProfile?.user_id,
          actorUserId: profile.user_id,
          type: "group_joined",
          title: "Group joined",
          body: `Someone joined ${groupTitle}.`,
          href: `/groups/${groupId}`,
        });
      }),
    );
  }

  revalidatePath("/groups");
  revalidatePath("/discover/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/discussions`);
  revalidatePath(`/groups/${groupId}/discussions/new`);
  redirect(`/groups/${groupId}`);
}

export async function leaveGroup(formData: FormData) {
  const groupId = getFormString(formData, "group_id");

  if (!groupId) {
    redirect("/groups");
  }

  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("group_memberships")
    .select("role")
    .eq("group_id", groupId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (membershipError) {
    redirect(`/groups/${groupId}?message=${encodeURIComponent(membershipError.message)}`);
  }

  if (!membership) {
    redirect(`/groups/${groupId}`);
  }

  if (membership.role === "owner" || membership.role === "leader") {
    redirect(`/groups/${groupId}?message=Group leaders cannot leave their own group.`);
  }

  const { error } = await admin
    .from("group_memberships")
    .delete()
    .eq("group_id", groupId)
    .eq("profile_id", profile.id);

  if (error) {
    redirect(`/groups/${groupId}?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/groups");
  revalidatePath("/discover/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/discussions`);
  revalidatePath(`/groups/${groupId}/discussions/new`);
  redirect(`/groups/${groupId}`);
}

export async function deleteOwnedGroup(formData: FormData) {
  const groupId = getFormString(formData, "group_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!groupId) {
    redirect("/groups?message=Group not found.");
  }

  if (confirmation !== "DELETE") {
    redirect(`/groups/${groupId}?message=Type DELETE to confirm group deletion.`);
  }

  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const { data: group, error } = await admin
    .from("study_groups")
    .select("id,title,created_by")
    .eq("id", groupId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!group) {
    redirect("/groups?message=Group not found.");
  }

  if (!(await canManageGroup(groupId, { profile }))) {
    redirect(`/groups/${groupId}?message=You can only delete groups you own.`);
  }

  const { error: deleteError } = await admin.from("study_groups").delete().eq("id", groupId);

  if (deleteError) {
    redirect(`/groups/${groupId}?message=${encodeURIComponent(deleteError.message)}`);
  }

  revalidatePath("/groups");
  revalidatePath("/discover/groups");
  redirect("/groups?message=Group deleted.");
}
