"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
};

export type GroupCommunityOption = {
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

export async function getGroupCommunityOptions(): Promise<GroupCommunityOption[]> {
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
  redirect("/groups");
}

function normalizeGroup(row: Record<string, unknown>, role: string | null): StudyGroup {
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
  };
}

function groupSelect(supportsPhase5Columns: boolean) {
  return supportsPhase5Columns
    ? "id,title,name,description,meeting_time,meeting_schedule,location,community_id,church_id,created_by,churches:community_id(name)"
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

  return ((data || []) as unknown as Record<string, unknown>[])
    .filter((membership) => membership.study_groups)
    .map((membership) =>
      normalizeGroup(
        membership.study_groups as Record<string, unknown>,
        typeof membership.role === "string" ? membership.role : null,
      ),
    );
}

export async function getStudyGroupById(id: string): Promise<StudyGroup | null> {
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const supportsPhase5Columns = await hasColumn("study_groups", "title");
  const { data: membership, error: membershipError } = await admin
    .from("group_memberships")
    .select("role")
    .eq("group_id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    return null;
  }

  const { data, error } = await admin
    .from("study_groups")
    .select(groupSelect(supportsPhase5Columns))
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data
    ? normalizeGroup(data as unknown as Record<string, unknown>, membership.role)
    : null;
}
