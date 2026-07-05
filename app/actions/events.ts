"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotification } from "@/lib/notifications/service";
import { getCurrentProfile, getOptionalAuthAndProfile } from "@/lib/auth/current";
import { canCreateEvent } from "@/lib/auth/ownership";
import { assertNotBanned } from "@/lib/moderation/bans";
import { createAdminClient } from "@/lib/supabase/admin";

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
  rsvp_counts: EventRsvpCounts;
  user_rsvp_status: EventRsvpStatusValue | null;
};

export type EventRsvpStatusValue = "going" | "interested";

export type EventRsvpCounts = {
  going: number;
  interested: number;
  total: number;
};

export type EventRsvpStatus = {
  isSignedIn: boolean;
  status: EventRsvpStatusValue | null;
};

export type EventCommunityOption = {
  id: string;
  name: string;
};

export type EventGroupOption = {
  id: string;
  title: string;
};

export type EventCreationAccess = {
  role: string;
  canCreate: boolean;
  message: string | null;
};

type Profile = {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  return value.length > 0 ? value : null;
}

async function getOptionalProfile(): Promise<Profile | null> {
  const auth = await getOptionalAuthAndProfile();
  return auth?.profile || null;
}

async function getOptionalUser() {
  const auth = await getOptionalAuthAndProfile();
  return auth?.user || null;
}

async function hasTable(table: string) {
  const admin = createAdminClient();
  const { error } = await admin.from(table).select("id").limit(1);
  return !error;
}

async function hasColumn(table: string, column: string) {
  const admin = createAdminClient();
  const { error } = await admin.from(table).select(column).limit(1);
  return !error;
}

export async function getEventCommunityOptions(): Promise<EventCommunityOption[]> {
  const profile = await getCurrentProfile();
  await assertNotBanned(profile.user_id);

  if (profile.role !== "platform_engineer") {
    return [];
  }

  const admin = createAdminClient();

  if (profile.role === "platform_engineer") {
    const { data, error } = await admin
      .from("churches")
      .select("id,name")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return ((data || []) as unknown as Record<string, unknown>[]).map((community) => ({
      id: String(community.id),
      name: String(community.name),
    }));
  }

  let query = admin
    .from("church_memberships")
    .select("churches:church_id(id,name)")
    .eq("role", "owner")
    .order("created_at", { ascending: false });

  query = query.eq("profile_id", profile.id);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || [])
    .filter((membership) => membership.churches)
    .map((membership) => membership.churches as unknown as EventCommunityOption);
}

export async function getEventCreationAccess(): Promise<EventCreationAccess> {
  const profile = await getCurrentProfile();
  const canCreate = profile.role === "platform_engineer";

  return {
    role: profile.role || "user",
    canCreate,
    message: canCreate ? null : "Only platform engineers can create official events right now.",
  };
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

  if (profile.role !== "platform_engineer") {
    redirect("/events/new?message=Only platform engineers can create official events right now.");
  }

  if (!communityId) {
    redirect("/events/new?message=Choose a community for this official event.");
  }

  if (!(await canCreateEvent(communityId, { profile }))) {
    redirect("/events/new?message=You can only create events for communities you lead.");
  }

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

async function getEventRsvpData(
  eventIds: string[],
  userId: string | null,
): Promise<{
  counts: Map<string, EventRsvpCounts>;
  statuses: Map<string, EventRsvpStatusValue>;
}> {
  const counts = new Map<string, EventRsvpCounts>();
  const statuses = new Map<string, EventRsvpStatusValue>();

  if (eventIds.length === 0 || !(await hasTable("event_rsvps"))) {
    return { counts, statuses };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_rsvps")
    .select("event_id,user_id,status")
    .in("event_id", eventIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data || []) as unknown as Record<string, unknown>[]) {
    const eventId = typeof row.event_id === "string" ? row.event_id : "";
    const status = row.status === "going" || row.status === "interested" ? row.status : null;

    if (!eventId || !status) {
      continue;
    }

    const current = counts.get(eventId) || { going: 0, interested: 0, total: 0 };
    current[status] += 1;
    current.total += 1;
    counts.set(eventId, current);

    if (userId && row.user_id === userId) {
      statuses.set(eventId, status);
    }
  }

  return { counts, statuses };
}

function eventSelect(supportsPhase6Columns: boolean) {
  return supportsPhase6Columns
    ? "id,title,description,event_time,starts_at,location,community_id,church_id,group_id,created_by,churches:community_id(name),study_groups:group_id(id,title,name)"
    : "id,title,description,starts_at,location,church_id,group_id,created_by,churches:church_id(name),study_groups:group_id(id,name)";
}

function normalizeEvent(
  row: Record<string, unknown>,
  profileId: string | null,
  rsvpCounts: EventRsvpCounts = { going: 0, interested: 0, total: 0 },
  userRsvpStatus: EventRsvpStatusValue | null = null,
): EventRecord {
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
    is_owner: Boolean(profileId) && row.created_by === profileId,
    rsvp_counts: rsvpCounts,
    user_rsvp_status: userRsvpStatus,
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

  const rows = (data || []) as unknown as Record<string, unknown>[];
  const eventIds = rows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string");
  const rsvps = await getEventRsvpData(eventIds, profile.user_id);

  return rows.map((row) =>
    normalizeEvent(
      row,
      profile.id,
      rsvps.counts.get(String(row.id)),
      rsvps.statuses.get(String(row.id)) || null,
    ),
  );
}

export async function getEventById(id: string): Promise<EventRecord | null> {
  const profile = await getOptionalProfile();
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

  if (!data) {
    return null;
  }

  const rsvps = await getEventRsvpData([id], profile?.user_id || null);

  return normalizeEvent(
    data as unknown as Record<string, unknown>,
    profile?.id || null,
    rsvps.counts.get(id),
    rsvps.statuses.get(id) || null,
  );
}

export async function getEventRsvpStatus(eventId: string): Promise<EventRsvpStatus> {
  const user = await getOptionalUser();

  if (!user) {
    return {
      isSignedIn: false,
      status: null,
    };
  }

  if (!(await hasTable("event_rsvps"))) {
    return {
      isSignedIn: true,
      status: null,
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_rsvps")
    .select("status")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    isSignedIn: true,
    status: data?.status === "going" || data?.status === "interested" ? data.status : null,
  };
}

export async function setEventRsvp(formData: FormData) {
  const eventId = getFormString(formData, "event_id");
  const status = getFormString(formData, "status");

  if (!eventId) {
    redirect("/events");
  }

  if (status !== "going" && status !== "interested") {
    redirect(`/events/${eventId}?message=Please choose a valid RSVP.`);
  }

  const user = await getOptionalUser();

  if (!user) {
    redirect("/signin");
  }

  await assertNotBanned(user.id);

  const admin = createAdminClient();
  const { error } = await admin.from("event_rsvps").upsert(
    {
      event_id: eventId,
      user_id: user.id,
      status,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "event_id,user_id",
    },
  );

  if (error) {
    redirect(`/events/${eventId}?message=${encodeURIComponent(error.message)}`);
  }

  const { data: event, error: eventError } = await admin
    .from("events")
    .select("title,created_by,profiles:created_by(user_id)")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    throw new Error(eventError.message);
  }

  const ownerProfile = (event as unknown as { profiles?: { user_id?: string } | null })?.profiles;
  const eventTitle =
    typeof event?.title === "string" ? event.title : "your event";

  await createNotification({
    userId: ownerProfile?.user_id,
    actorUserId: user.id,
    type: "event_rsvp",
    title: "Event RSVP",
    body: `Someone marked ${status} for ${eventTitle}.`,
    href: `/events/${eventId}`,
  });

  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function removeEventRsvp(formData: FormData) {
  const eventId = getFormString(formData, "event_id");

  if (!eventId) {
    redirect("/events");
  }

  const user = await getOptionalUser();

  if (!user) {
    redirect("/signin");
  }

  await assertNotBanned(user.id);

  const admin = createAdminClient();
  const { error } = await admin
    .from("event_rsvps")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/events/${eventId}?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function deleteOwnedEvent(formData: FormData) {
  const eventId = getFormString(formData, "event_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!eventId) {
    redirect("/events?message=Event not found.");
  }

  if (confirmation !== "DELETE") {
    redirect(`/events/${eventId}?message=Type DELETE to confirm event deletion.`);
  }

  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const { data: event, error } = await admin
    .from("events")
    .select("id,title,created_by")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!event) {
    redirect("/events?message=Event not found.");
  }

  if (profile.role !== "platform_engineer" && String(event.created_by) !== profile.id) {
    redirect(`/events/${eventId}?message=You can only delete events you own.`);
  }

  const { error: deleteError } = await admin.from("events").delete().eq("id", eventId);

  if (deleteError) {
    redirect(`/events/${eventId}?message=${encodeURIComponent(deleteError.message)}`);
  }

  revalidatePath("/events");
  redirect("/events?message=Event deleted.");
}
