"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  event_time: string;
  location: string | null;
  community_id: string | null;
  community_name: string | null;
  group_id: string | null;
  group_title: string | null;
  created_by: string | null;
  is_owner: boolean;
};

export type EventCommunityOption = {
  id: string;
  name: string;
};

export type EventGroupOption = {
  id: string;
  title: string;
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

export async function getEventCommunityOptions(): Promise<EventCommunityOption[]> {
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
    .map((membership) => membership.churches as unknown as EventCommunityOption);
}

export async function getEventGroupOptions(): Promise<EventGroupOption[]> {
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const supportsTitle = await hasColumn("study_groups", "title");
  const select = supportsTitle ? "study_groups:group_id(id,title,name)" : "study_groups:group_id(id,name)";
  const { data, error } = await admin
    .from("group_memberships")
    .select(select)
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as unknown as Record<string, unknown>[])
    .filter((membership) => membership.study_groups)
    .map((membership) => {
      const group = membership.study_groups as Record<string, unknown>;
      return {
        id: String(group.id),
        title: typeof group.title === "string" ? group.title : String(group.name || ""),
      };
    });
}

export async function createEvent(formData: FormData) {
  const title = getFormString(formData, "title");
  const eventTime = getFormString(formData, "event_time");

  if (!title || !eventTime) {
    redirect("/events/new?message=Title and event time are required.");
  }

  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const supportsEventTime = await hasColumn("events", "event_time");
  const supportsCommunityId = await hasColumn("events", "community_id");
  const communityId = nullableFormString(formData, "community_id");
  const payload: Record<string, string | null> = {
    title,
    description: nullableFormString(formData, "description"),
    starts_at: eventTime,
    location: nullableFormString(formData, "location"),
    church_id: communityId,
    group_id: nullableFormString(formData, "group_id"),
    created_by: profile.id,
  };

  if (supportsEventTime) {
    payload.event_time = eventTime;
  }

  if (supportsCommunityId) {
    payload.community_id = communityId;
  }

  const { error } = await admin.from("events").insert(payload);

  if (error) {
    redirect(`/events/new?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/events");
  redirect("/events");
}

function eventSelect(supportsPhase6Columns: boolean) {
  return supportsPhase6Columns
    ? "id,title,description,event_time,starts_at,location,community_id,church_id,group_id,created_by,churches:community_id(name),study_groups:group_id(id,title,name)"
    : "id,title,description,starts_at,location,church_id,group_id,created_by,churches:church_id(name),study_groups:group_id(id,name)";
}

function normalizeEvent(row: Record<string, unknown>, profileId: string): EventRecord {
  const community = row.churches as { name?: string } | null | undefined;
  const group = row.study_groups as { title?: string; name?: string } | null | undefined;
  const eventTime = row.event_time || row.starts_at;

  return {
    id: String(row.id),
    title: String(row.title),
    description: typeof row.description === "string" ? row.description : null,
    event_time: String(eventTime),
    location: typeof row.location === "string" ? row.location : null,
    community_id:
      typeof row.community_id === "string"
        ? row.community_id
        : typeof row.church_id === "string"
          ? row.church_id
          : null,
    community_name: community?.name || null,
    group_id: typeof row.group_id === "string" ? row.group_id : null,
    group_title: group?.title || group?.name || null,
    created_by: typeof row.created_by === "string" ? row.created_by : null,
    is_owner: row.created_by === profileId,
  };
}

export async function getVisibleEvents(): Promise<EventRecord[]> {
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const supportsPhase6Columns = await hasColumn("events", "event_time");
  const { data, error } = await admin
    .from("events")
    .select(eventSelect(supportsPhase6Columns))
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as unknown as Record<string, unknown>[]).map((row) =>
    normalizeEvent(row, profile.id),
  );
}

export async function getEventById(id: string): Promise<EventRecord | null> {
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const supportsPhase6Columns = await hasColumn("events", "event_time");
  const { data, error } = await admin
    .from("events")
    .select(eventSelect(supportsPhase6Columns))
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? normalizeEvent(data as unknown as Record<string, unknown>, profile.id) : null;
}
