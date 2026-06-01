"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LeaderCommunity = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  banner_url: string | null;
  is_published: boolean;
  member_count: number;
};

export type LeaderMember = {
  id: string;
  role: string;
  created_at: string;
  display_name: string;
};

export type LeaderPrayerRequest = {
  id: string;
  title: string;
  content: string | null;
  is_private: boolean;
  created_at: string;
};

export type LeaderStudyGroup = {
  id: string;
  title: string;
  meeting_time: string | null;
  location: string | null;
  member_count: number;
};

export type LeaderEvent = {
  id: string;
  title: string;
  event_time: string;
  location: string | null;
  going_count: number;
  interested_count: number;
};

export type CommunityManagementSummary = {
  community: LeaderCommunity;
  members: LeaderMember[];
  prayer_requests: LeaderPrayerRequest[];
  study_groups: LeaderStudyGroup[];
  events: LeaderEvent[];
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
    .select("id,user_id,display_name,role")
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { ...data, role: typeof (data as { role?: unknown }).role === "string" ? String((data as { role?: unknown }).role) : "user" };
}

async function hasColumn(table: string, column: string) {
  const admin = createAdminClient();
  const { error } = await admin.from(table).select(column).limit(1);
  return !error;
}

async function requireOwnedCommunity(communityId: string, profile: Profile) {
  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("church_memberships")
    .select("role")
    .eq("church_id", communityId)
    .eq("profile_id", profile.id)
    .eq("role", "owner")
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    return null;
  }

  const { data: community, error } = await admin
    .from("churches")
    .select("id,name,slug,description,location,banner_url,created_by,is_published")
    .eq("id", communityId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return community;
}

async function getCommunityMemberCounts(communityIds: string[]) {
  const counts = new Map<string, number>();

  if (communityIds.length === 0) {
    return counts;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("church_memberships")
    .select("church_id")
    .in("church_id", communityIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data || []) {
    const communityId = typeof row.church_id === "string" ? row.church_id : "";
    if (communityId) {
      counts.set(communityId, (counts.get(communityId) || 0) + 1);
    }
  }

  return counts;
}

async function getGroupMemberCounts(groupIds: string[]) {
  const counts = new Map<string, number>();

  if (groupIds.length === 0) {
    return counts;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("group_memberships")
    .select("group_id")
    .in("group_id", groupIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data || []) {
    const groupId = typeof row.group_id === "string" ? row.group_id : "";
    if (groupId) {
      counts.set(groupId, (counts.get(groupId) || 0) + 1);
    }
  }

  return counts;
}

async function getEventRsvpCounts(eventIds: string[]) {
  const counts = new Map<string, { going: number; interested: number }>();

  if (eventIds.length === 0) {
    return counts;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_rsvps")
    .select("event_id,status")
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

    const current = counts.get(eventId) || { going: 0, interested: 0 };
    current[status] += 1;
    counts.set(eventId, current);
  }

  return counts;
}

function normalizeCommunity(row: Record<string, unknown>, memberCount = 0): LeaderCommunity {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: typeof row.description === "string" ? row.description : null,
    location: typeof row.location === "string" ? row.location : null,
    banner_url: typeof row.banner_url === "string" ? row.banner_url : null,
    is_published: row.is_published !== false,
    member_count: memberCount,
  };
}

export async function getOwnedCommunities(): Promise<LeaderCommunity[]> {
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("church_memberships")
    .select("churches:church_id(id,name,slug,description,location,banner_url,created_by,is_published)")
    .eq("profile_id", profile.id)
    .eq("role", "owner")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data || []) as unknown as Record<string, unknown>[]).filter(
    (row) => row.churches,
  );
  const communityIds = rows
    .map((row) => (row.churches as Record<string, unknown>).id)
    .filter((id): id is string => typeof id === "string");
  const counts = await getCommunityMemberCounts(communityIds);

  return rows.map((row) => {
    const community = row.churches as Record<string, unknown>;
    return normalizeCommunity(community, counts.get(String(community.id)) || 0);
  });
}

export async function getCommunityManagementSummary(
  communityId: string,
): Promise<CommunityManagementSummary | null> {
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const community = await requireOwnedCommunity(communityId, profile);

  if (!community) {
    return null;
  }

  const [
    memberCounts,
    supportsPrayerContent,
    supportsGroupTitle,
    supportsGroupCommunityId,
    supportsEventTime,
    supportsEventCommunityId,
  ] =
    await Promise.all([
      getCommunityMemberCounts([communityId]),
      hasColumn("prayer_requests", "content"),
      hasColumn("study_groups", "title"),
      hasColumn("study_groups", "community_id"),
      hasColumn("events", "event_time"),
      hasColumn("events", "community_id"),
    ]);

  const prayerSelect = supportsPrayerContent
    ? "id,title,body,content,is_private,created_at,profile_id"
    : "id,title,body,is_private,created_at,profile_id";
  const { data: prayerData, error: prayerError } = await admin
    .from("prayer_requests")
    .select(prayerSelect)
    .eq("community_id", communityId)
    .or(`is_private.eq.false,profile_id.eq.${profile.id}`)
    .order("created_at", { ascending: false })
    .limit(8);

  if (prayerError) {
    throw new Error(prayerError.message);
  }

  const groupSelect = supportsGroupTitle
    ? "id,title,name,description,meeting_time,meeting_schedule,location,community_id,church_id"
    : "id,name,description,meeting_schedule,church_id";
  const groupCommunityColumn = supportsGroupCommunityId ? "community_id" : "church_id";
  const { data: groupData, error: groupError } = await admin
    .from("study_groups")
    .select(groupSelect)
    .eq(groupCommunityColumn, communityId)
    .order("created_at", { ascending: false });

  if (groupError) {
    throw new Error(groupError.message);
  }

  const eventSelect = supportsEventTime
    ? "id,title,event_time,starts_at,location,community_id,church_id"
    : "id,title,starts_at,location,church_id";
  const eventCommunityColumn = supportsEventCommunityId ? "community_id" : "church_id";
  const { data: eventData, error: eventError } = await admin
    .from("events")
    .select(eventSelect)
    .eq(eventCommunityColumn, communityId)
    .order("starts_at", { ascending: true })
    .limit(12);

  if (eventError) {
    throw new Error(eventError.message);
  }

  const { data: memberData, error: memberError } = await admin
    .from("church_memberships")
    .select("id,role,created_at,profiles:profile_id(display_name)")
    .eq("church_id", communityId)
    .order("created_at", { ascending: true })
    .limit(24);

  if (memberError) {
    throw new Error(memberError.message);
  }

  const groupRows = (groupData || []) as unknown as Record<string, unknown>[];
  const groupIds = groupRows
    .map((group) => group.id)
    .filter((id): id is string => typeof id === "string");
  const groupCounts = await getGroupMemberCounts(groupIds);

  const eventRows = (eventData || []) as unknown as Record<string, unknown>[];
  const eventIds = eventRows
    .map((event) => event.id)
    .filter((id): id is string => typeof id === "string");
  const eventCounts = await getEventRsvpCounts(eventIds);

  return {
    community: normalizeCommunity(
      community as unknown as Record<string, unknown>,
      memberCounts.get(communityId) || 0,
    ),
    members: ((memberData || []) as unknown as Record<string, unknown>[]).map((member) => {
      const profileRecord = member.profiles as { display_name?: string } | null | undefined;

      return {
        id: String(member.id),
        role: typeof member.role === "string" ? member.role : "member",
        created_at: String(member.created_at),
        display_name: profileRecord?.display_name || "Selah Ember Member",
      };
    }),
    prayer_requests: ((prayerData || []) as unknown as Record<string, unknown>[]).map((request) => {
      const content = supportsPrayerContent ? request.content : request.body;

      return {
        id: String(request.id),
        title: String(request.title),
        content: typeof content === "string" ? content : null,
        is_private: Boolean(request.is_private),
        created_at: String(request.created_at),
      };
    }),
    study_groups: groupRows.map((group) => ({
      id: String(group.id),
      title: typeof group.title === "string" ? group.title : String(group.name || ""),
      meeting_time:
        typeof group.meeting_time === "string"
          ? group.meeting_time
          : typeof group.meeting_schedule === "string"
            ? group.meeting_schedule
            : null,
      location: typeof group.location === "string" ? group.location : null,
      member_count: groupCounts.get(String(group.id)) || 0,
    })),
    events: eventRows.map((event) => {
      const rsvps = eventCounts.get(String(event.id)) || { going: 0, interested: 0 };

      return {
        id: String(event.id),
        title: String(event.title),
        event_time: String(event.event_time || event.starts_at),
        location: typeof event.location === "string" ? event.location : null,
        going_count: rsvps.going,
        interested_count: rsvps.interested,
      };
    }),
  };
}

export async function updateOwnedCommunity(formData: FormData) {
  const communityId = getFormString(formData, "community_id");

  if (!communityId) {
    redirect("/leader");
  }

  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const community = await requireOwnedCommunity(communityId, profile);

  if (!community) {
    redirect("/leader");
  }

  const name = getFormString(formData, "name");

  if (!name) {
    redirect(`/leader/communities/${communityId}?message=Community name is required.`);
  }

  const { error } = await admin
    .from("churches")
    .update({
      name,
      description: nullableFormString(formData, "description"),
      location: nullableFormString(formData, "location"),
      banner_url: nullableFormString(formData, "banner_url"),
    })
    .eq("id", communityId);

  if (error) {
    redirect(`/leader/communities/${communityId}?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/leader");
  revalidatePath(`/leader/communities/${communityId}`);
  revalidatePath("/communities");
  revalidatePath("/discover");
  revalidatePath(`/c/${community.slug}`);
  redirect(`/leader/communities/${communityId}?message=Community updated.`);
}
