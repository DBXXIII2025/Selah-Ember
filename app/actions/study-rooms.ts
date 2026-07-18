"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotification } from "@/lib/notifications/service";
import { getErrorMetadata } from "@/lib/observability/log";
import { logRequestEvent } from "@/lib/observability/request";
import {
  getRequiredStudyRoomProfile,
  getStudyRoomAccess,
  requireStudyRoomAccess,
  requireStudyRoomLeader,
  requireStudyRoomMembership,
  requireStudyRoomModerator,
  requireStudyRoomOwner,
} from "@/lib/study-rooms/permissions";
import {
  STUDY_PROGRESS_STATUSES,
  STUDY_ROOM_LIMITS,
  STUDY_ROOM_MEMBERSHIP_MODES,
  STUDY_ROOM_PRAYER_CATEGORIES,
  STUDY_ROOM_PRAYER_STATUSES,
  STUDY_ROOM_REPORT_TARGETS,
  STUDY_ROOM_ROLES,
  STUDY_ROOM_RESOURCE_TYPES,
  STUDY_ROOM_STATUSES,
  STUDY_ROOM_VISIBILITIES,
  STUDY_STATUSES,
  type StudyProgressStatus,
  type StudyRoomMembershipMode,
  type StudyRoomPrayerCategory,
  type StudyRoomPrayerStatus,
  type StudyRoomReportTarget,
  type StudyRoomRole,
  type StudyRoomResourceType,
  type StudyRoomStatus,
  type StudyRoomVisibility,
  type StudyStatus,
  getFormString,
  getOptionalFormString,
  isSafeHttpUrl,
  isStudyRoomUuid,
  pickAllowedValue,
  safeReturnPath,
} from "@/lib/study-rooms/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export type StudyRoomSummary = {
  id: string;
  name: string;
  description: string;
  cover_image_url: string | null;
  study_topic: string | null;
  primary_bible_book: string | null;
  current_scripture_reference: string | null;
  pinned_scripture_reference: string | null;
  visibility: StudyRoomVisibility;
  membership_mode: StudyRoomMembershipMode;
  status: StudyRoomStatus;
  role: StudyRoomRole | null;
  member_count: number;
  updated_at: string;
};

export type StudyRoomStudy = {
  id: string;
  room_id: string;
  title: string;
  description: string | null;
  scripture_reference: string | null;
  study_number: number | null;
  scheduled_at: string | null;
  status: StudyStatus;
  leader_notes: string | null;
  closing_reflection: string | null;
  created_at: string;
  updated_at: string;
  viewer_progress: StudyProgressStatus;
  completed_count: number | null;
};

export type StudyRoomMember = {
  id: string;
  profile_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  role: StudyRoomRole;
  created_at: string;
};

export type StudyRoomJoinRequest = {
  id: string;
  profile_id: string;
  display_name: string;
  message: string | null;
  created_at: string;
};

export type StudyRoomInvitation = {
  id: string;
  invited_profile_id: string;
  display_name: string;
  role: Exclude<StudyRoomRole, "owner">;
  message: string | null;
  created_at: string;
};

export type StudyRoomAuthorContent = {
  id: string;
  author_user_id: string | null;
  author_name: string;
  canEdit: boolean;
  canModerate: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type StudyRoomNote = StudyRoomAuthorContent & {
  room_id: string;
  study_id: string | null;
  study_title: string | null;
  study_number: number | null;
  title: string;
  body: string;
  scripture_reference: string | null;
  is_bookmarked: boolean;
};

export type StudyRoomDiscussionReply = StudyRoomAuthorContent & {
  thread_id: string;
  body: string;
};

export type StudyRoomDiscussionThread = StudyRoomAuthorContent & {
  room_id: string;
  study_id: string | null;
  study_title: string | null;
  study_number: number | null;
  title: string;
  body: string;
  is_pinned: boolean;
  is_locked: boolean;
  is_bookmarked: boolean;
  replies: StudyRoomDiscussionReply[];
};

export type StudyRoomPrayerRequest = StudyRoomAuthorContent & {
  room_id: string;
  study_id: string | null;
  study_title: string | null;
  study_number: number | null;
  title: string;
  body: string;
  category: StudyRoomPrayerCategory;
  status: StudyRoomPrayerStatus;
  answered_at: string | null;
  answered_update: string | null;
  support_count: number;
  viewer_supports: boolean;
};

export type StudyRoomResource = {
  id: string;
  room_id: string;
  study_id: string | null;
  study_title: string | null;
  study_number: number | null;
  created_by_profile_id: string | null;
  creator_name: string;
  title: string;
  description: string | null;
  external_url: string;
  resource_type: StudyRoomResourceType;
  canEdit: boolean;
  canModerate: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type StudyRoomInviteSearchResult = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
};

export type StudyRoomOverviewData = {
  room: StudyRoomSummary | null;
  viewer: {
    isSignedIn: boolean;
    role: StudyRoomRole | null;
    isMember: boolean;
    canManage: boolean;
    canLead: boolean;
    canModerate: boolean;
    isPlatformEngineer: boolean;
  };
  currentStudy: StudyRoomStudy | null;
  nextStudy: StudyRoomStudy | null;
  recentNotes: Array<{
    id: string;
    title: string;
    scripture_reference: string | null;
    author_name: string;
    updated_at: string;
  }>;
  recentPrayerRequests: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    updated_at: string;
  }>;
  recentDiscussions: Array<{
    id: string;
    title: string;
    author_name: string;
    updated_at: string;
  }>;
  resources: Array<{
    id: string;
    title: string;
    resource_type: string;
    external_url: string;
  }>;
  memberSummary: {
    total: number;
    owners: number;
    leaders: number;
    moderators: number;
    members: number;
  };
};

export type StudyRoomDetailData = StudyRoomOverviewData & {
  studies: StudyRoomStudy[];
  members: StudyRoomMember[];
  pendingJoinRequests: StudyRoomJoinRequest[];
  pendingInvitations: StudyRoomInvitation[];
  notes: StudyRoomNote[];
  discussionThreads: StudyRoomDiscussionThread[];
  prayerRequests: StudyRoomPrayerRequest[];
  resourcesDetail: StudyRoomResource[];
  savedNotes: StudyRoomNote[];
  savedThreads: StudyRoomDiscussionThread[];
};

const roomSummarySelect =
  "id,name,description,cover_image_url,study_topic,primary_bible_book,current_scripture_reference,pinned_scripture_reference,visibility,membership_mode,status,owner_profile_id,updated_at";

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

function withMessage(path: string, message: string) {
  return `${path}${path.includes("?") ? "&" : "?"}message=${encodeMessage(message)}`;
}

function normalizeRoomSummary(
  row: Record<string, unknown>,
  role: StudyRoomRole | null,
  memberCount: number,
): StudyRoomSummary {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    cover_image_url: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
    study_topic: typeof row.study_topic === "string" ? row.study_topic : null,
    primary_bible_book: typeof row.primary_bible_book === "string" ? row.primary_bible_book : null,
    current_scripture_reference:
      typeof row.current_scripture_reference === "string" ? row.current_scripture_reference : null,
    pinned_scripture_reference:
      typeof row.pinned_scripture_reference === "string" ? row.pinned_scripture_reference : null,
    visibility:
      row.visibility === "private" || row.visibility === "unlisted" ? row.visibility : "public",
    membership_mode:
      row.membership_mode === "request_to_join" || row.membership_mode === "invite_only"
        ? row.membership_mode
        : "open_join",
    status: row.status === "completed" || row.status === "archived" ? row.status : "active",
    role,
    member_count: memberCount,
    updated_at: String(row.updated_at),
  };
}

function normalizeStudy(
  row: Record<string, unknown>,
  progressByStudy: Map<string, StudyProgressStatus>,
  completedCounts?: Map<string, number>,
): StudyRoomStudy {
  const id = String(row.id);

  return {
    id,
    room_id: String(row.room_id),
    title: String(row.title),
    description: typeof row.description === "string" ? row.description : null,
    scripture_reference: typeof row.scripture_reference === "string" ? row.scripture_reference : null,
    study_number: typeof row.study_number === "number" ? row.study_number : null,
    scheduled_at: typeof row.scheduled_at === "string" ? row.scheduled_at : null,
    status:
      row.status === "upcoming" || row.status === "active" || row.status === "completed"
        ? row.status
        : "draft",
    leader_notes: typeof row.leader_notes === "string" ? row.leader_notes : null,
    closing_reflection: typeof row.closing_reflection === "string" ? row.closing_reflection : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    viewer_progress: progressByStudy.get(id) || "not_started",
    completed_count: completedCounts?.get(id) ?? null,
  };
}

async function getMemberCounts(roomIds: string[]) {
  const counts = new Map<string, number>();

  if (roomIds.length === 0) {
    return counts;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("study_room_members")
    .select("room_id")
    .in("room_id", roomIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data || []) {
    const roomId = typeof row.room_id === "string" ? row.room_id : "";

    if (roomId) {
      counts.set(roomId, (counts.get(roomId) || 0) + 1);
    }
  }

  return counts;
}

async function getViewerRoles(roomIds: string[], profileId: string | null) {
  const roles = new Map<string, StudyRoomRole>();

  if (!profileId || roomIds.length === 0) {
    return roles;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("study_room_members")
    .select("room_id,role")
    .eq("profile_id", profileId)
    .in("room_id", roomIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data || []) {
    if (typeof row.room_id === "string" && typeof row.role === "string") {
      roles.set(row.room_id, row.role as StudyRoomRole);
    }
  }

  return roles;
}

async function notifyRoomLeaders(roomId: string, actorUserId: string, input: {
  type: string;
  title: string;
  body?: string | null;
  href: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("study_room_members")
    .select("profiles:profile_id(user_id)")
    .eq("room_id", roomId)
    .in("role", ["owner", "leader"]);

  if (error) {
    throw new Error(error.message);
  }

  await Promise.all(
    ((data || []) as unknown as Record<string, unknown>[]).map((membership) => {
      const profile = membership.profiles as { user_id?: string } | null | undefined;
      return createNotification({
        userId: profile?.user_id,
        actorUserId,
        ...input,
      });
    }),
  );
}

export async function getStudyRoomsList(
  search = "",
  status: StudyRoomStatus | "all" = "active",
  page = 1,
  topic = "",
) {
  const profile = await getRequiredStudyRoomProfile("/study-rooms");
  const admin = createAdminClient();
  const from = Math.max(0, page - 1) * 20;
  const to = from + 19;
  const term = search.trim();
  const topicTerm = topic.trim();

  let memberQuery = admin
    .from("study_room_members")
    .select(`role, study_rooms:room_id(${roomSummarySelect})`)
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  let discoverQuery = admin
    .from("study_rooms")
    .select(roomSummarySelect)
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    memberQuery = memberQuery.eq("study_rooms.status", status);
    discoverQuery = discoverQuery.eq("status", status);
  }

  if (term) {
    const escaped = term.replace(/[,%()]/g, " ");
    const filters = [
      `name.ilike.%${escaped}%`,
      `description.ilike.%${escaped}%`,
      `study_topic.ilike.%${escaped}%`,
      `primary_bible_book.ilike.%${escaped}%`,
    ].join(",");

    discoverQuery = discoverQuery.or(filters);
  }

  if (topicTerm) {
    const escapedTopic = topicTerm.replace(/[,%()]/g, " ");
    discoverQuery = discoverQuery.or(`study_topic.ilike.%${escapedTopic}%,primary_bible_book.ilike.%${escapedTopic}%`);
  }

  const [{ data: memberRows, error: memberError }, { data: discoverRows, error: discoverError }] = await Promise.all([
    memberQuery,
    discoverQuery,
  ]);

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (discoverError) {
    throw new Error(discoverError.message);
  }

  const memberRoomRows = ((memberRows || []) as unknown as Record<string, unknown>[])
    .filter((row) => row.study_rooms)
    .map((row) => ({
      room: row.study_rooms as Record<string, unknown>,
      role: typeof row.role === "string" ? (row.role as StudyRoomRole) : null,
    }));
  const discoverRoomRows = ((discoverRows || []) as unknown as Record<string, unknown>[])
    .filter((row) => row.id)
    .map((room) => ({ room: room as Record<string, unknown>, role: null }));
  const roomIds = Array.from(
    new Set([...memberRoomRows, ...discoverRoomRows].map(({ room }) => String(room.id)).filter(isStudyRoomUuid)),
  );
  const [counts, roles] = await Promise.all([
    getMemberCounts(roomIds),
    getViewerRoles(roomIds, profile.id),
  ]);
  const byId = new Map<string, StudyRoomSummary>();

  for (const { room, role } of [...memberRoomRows, ...discoverRoomRows]) {
    const roomId = String(room.id);
    byId.set(roomId, normalizeRoomSummary(room, role || roles.get(roomId) || null, counts.get(roomId) || 0));
  }

  let rooms = Array.from(byId.values());

  if (term || topicTerm) {
    const normalizedTerm = term.toLowerCase();
    const normalizedTopic = topicTerm.toLowerCase();
    rooms = rooms.filter((room) => {
      const searchable = [
        room.name,
        room.description,
        room.study_topic || "",
        room.primary_bible_book || "",
      ].join(" ").toLowerCase();
      const topicSearchable = [room.study_topic || "", room.primary_bible_book || ""].join(" ").toLowerCase();
      return (!normalizedTerm || searchable.includes(normalizedTerm)) && (!normalizedTopic || topicSearchable.includes(normalizedTopic));
    });
  }

  return {
    memberRooms: rooms.filter((room) => room.role),
    discoverRooms: rooms.filter((room) => !room.role),
    page,
    pageSize: 20,
  };
}

export async function getStudyRoomOverview(roomId: string): Promise<StudyRoomOverviewData> {
  const access = await requireStudyRoomAccess(roomId);
  const admin = createAdminClient();

  if (!access.room) {
    return {
      room: null,
      viewer: {
        isSignedIn: access.isSignedIn,
        role: null,
        isMember: false,
        canManage: false,
        canLead: false,
        canModerate: false,
        isPlatformEngineer: access.isPlatformEngineer,
      },
      currentStudy: null,
      nextStudy: null,
      recentNotes: [],
      recentPrayerRequests: [],
      recentDiscussions: [],
      resources: [],
      memberSummary: { total: 0, owners: 0, leaders: 0, moderators: 0, members: 0 },
    };
  }

  const [
    { data: roomRow, error: roomError },
    { data: studiesRows, error: studiesError },
    { data: progressRows, error: progressError },
    { data: notesRows, error: notesError },
    { data: prayerRows, error: prayerError },
    { data: discussionRows, error: discussionError },
    { data: resourceRows, error: resourceError },
    { data: memberRows, error: memberError },
  ] = await Promise.all([
    admin.from("study_rooms").select(roomSummarySelect).eq("id", roomId).maybeSingle(),
    admin
      .from("study_room_studies")
      .select("id,room_id,title,description,scripture_reference,study_number,scheduled_at,status,leader_notes,closing_reflection,created_at,updated_at")
      .eq("room_id", roomId)
      .neq("status", "draft")
      .order("study_number", { ascending: true, nullsFirst: false })
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(100),
    access.profile
      ? admin
          .from("study_room_study_progress")
          .select("study_id,status")
          .eq("profile_id", access.profile.id)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("study_room_notes")
      .select("id,title,scripture_reference,author_user_id,updated_at")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5),
    admin
      .from("study_room_prayer_requests")
      .select("id,title,category,status,updated_at")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5),
    admin
      .from("study_room_discussion_threads")
      .select("id,title,author_user_id,updated_at")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(5),
    admin
      .from("study_room_resources")
      .select("id,title,resource_type,external_url")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("resource_type", { ascending: true })
      .limit(10),
    admin
      .from("study_room_members")
      .select("role")
      .eq("room_id", roomId),
  ]);

  for (const result of [
    roomError,
    studiesError,
    progressError,
    notesError,
    prayerError,
    discussionError,
    resourceError,
    memberError,
  ]) {
    if (result) {
      throw new Error(result.message);
    }
  }

  const memberCount = (memberRows || []).length;
  const progressByStudy = new Map<string, StudyProgressStatus>(
    ((progressRows || []) as unknown as Record<string, unknown>[])
      .filter((row) => typeof row.study_id === "string" && typeof row.status === "string")
      .map((row) => [String(row.study_id), row.status as StudyProgressStatus]),
  );
  const studies = ((studiesRows || []) as unknown as Record<string, unknown>[]).map((row) =>
    normalizeStudy(row, progressByStudy),
  );
  const currentStudy =
    studies.find((study) => study.status === "active") ||
    studies.find((study) => study.status === "upcoming") ||
    studies.find((study) => study.status !== "completed") ||
    null;
  const nextStudy = studies.find((study) => study.status === "upcoming" && study.id !== currentStudy?.id) || null;
  const authorIds = [
    ...((notesRows || []) as unknown as Record<string, unknown>[]).map((row) => row.author_user_id),
    ...((discussionRows || []) as unknown as Record<string, unknown>[]).map((row) => row.author_user_id),
  ].filter((id): id is string => typeof id === "string" && isStudyRoomUuid(id));
  const authorMap = await getAuthorDisplayMap(authorIds);
  const roleCounts = {
    owners: 0,
    leaders: 0,
    moderators: 0,
    members: 0,
  };

  for (const row of (memberRows || []) as unknown as Record<string, unknown>[]) {
    if (row.role === "owner") roleCounts.owners += 1;
    else if (row.role === "leader") roleCounts.leaders += 1;
    else if (row.role === "moderator") roleCounts.moderators += 1;
    else roleCounts.members += 1;
  }

  return {
    room: roomRow
      ? normalizeRoomSummary(roomRow as unknown as Record<string, unknown>, access.role, memberCount)
      : null,
    viewer: {
      isSignedIn: access.isSignedIn,
      role: access.role,
      isMember: access.isMember,
      canManage: access.canManage,
      canLead: access.canLead,
      canModerate: access.canModerate,
      isPlatformEngineer: access.isPlatformEngineer,
    },
    currentStudy,
    nextStudy,
    recentNotes: ((notesRows || []) as unknown as Record<string, unknown>[]).map((row) => {
      const authorId = typeof row.author_user_id === "string" ? row.author_user_id : "";
      return {
        id: String(row.id),
        title: String(row.title),
        scripture_reference: typeof row.scripture_reference === "string" ? row.scripture_reference : null,
        author_name: authorMap.get(authorId) || "Deleted user",
        updated_at: String(row.updated_at),
      };
    }),
    recentPrayerRequests: ((prayerRows || []) as unknown as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      category: String(row.category || "other"),
      status: String(row.status || "active"),
      updated_at: String(row.updated_at),
    })),
    recentDiscussions: ((discussionRows || []) as unknown as Record<string, unknown>[]).map((row) => {
      const authorId = typeof row.author_user_id === "string" ? row.author_user_id : "";
      return {
        id: String(row.id),
        title: String(row.title),
        author_name: authorMap.get(authorId) || "Deleted user",
        updated_at: String(row.updated_at),
      };
    }),
    resources: ((resourceRows || []) as unknown as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      resource_type: String(row.resource_type || "external_link"),
      external_url: String(row.external_url),
    })),
    memberSummary: {
      total: memberCount,
      ...roleCounts,
    },
  };
}

function normalizeAuthorContent(
  row: Record<string, unknown>,
  authorMap: Map<string, string>,
  viewerUserId: string | null,
  canModerate: boolean,
): StudyRoomAuthorContent {
  const authorUserId = typeof row.author_user_id === "string" ? row.author_user_id : null;
  const isOwnContent = Boolean(authorUserId && viewerUserId && authorUserId === viewerUserId);

  return {
    id: String(row.id),
    author_user_id: authorUserId,
    author_name: authorUserId ? authorMap.get(authorUserId) || "Deleted user" : "Deleted user",
    canEdit: isOwnContent || canModerate,
    canModerate,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
  };
}

export async function getStudyRoomDetail(roomId: string): Promise<StudyRoomDetailData> {
  const [overview, access] = await Promise.all([
    getStudyRoomOverview(roomId),
    getStudyRoomAccess(roomId),
  ]);

  if (!overview.room) {
    return {
      ...overview,
      studies: [],
      members: [],
      pendingJoinRequests: [],
      pendingInvitations: [],
      notes: [],
      discussionThreads: [],
      prayerRequests: [],
      resourcesDetail: [],
      savedNotes: [],
      savedThreads: [],
    };
  }

  const admin = createAdminClient();
  const canManageMembers = overview.viewer.canManage || overview.viewer.canLead;
  const [
    { data: studiesRows, error: studiesError },
    { data: progressRows, error: progressError },
    { data: memberRows, error: memberError },
    { data: requestRows, error: requestError },
    { data: invitationRows, error: invitationError },
    { data: noteRows, error: noteError },
    { data: threadRows, error: threadError },
    { data: prayerRows, error: prayerError },
    { data: resourceRows, error: resourceError },
    { data: bookmarkRows, error: bookmarkError },
  ] = await Promise.all([
    admin
      .from("study_room_studies")
      .select("id,room_id,title,description,scripture_reference,study_number,scheduled_at,status,leader_notes,closing_reflection,created_at,updated_at")
      .eq("room_id", roomId)
      .order("study_number", { ascending: true, nullsFirst: false })
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(100),
    access.profile
      ? admin
          .from("study_room_study_progress")
          .select("study_id,status")
          .eq("profile_id", access.profile.id)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("study_room_members")
      .select("id,profile_id,role,created_at,profiles:profile_id(display_name,username,avatar_url)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(200),
    canManageMembers
      ? admin
          .from("study_room_join_requests")
          .select("id,profile_id,message,created_at,profiles:profile_id(display_name)")
          .eq("room_id", roomId)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    canManageMembers
      ? admin
          .from("study_room_invitations")
          .select("id,invited_profile_id,role,message,created_at,profiles:invited_profile_id(display_name)")
          .eq("room_id", roomId)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("study_room_notes")
      .select("id,room_id,study_id,author_user_id,title,body,scripture_reference,deleted_at,created_at,updated_at")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(30),
    admin
      .from("study_room_discussion_threads")
      .select("id,room_id,study_id,author_user_id,title,body,is_pinned,is_locked,deleted_at,created_at,updated_at")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(20),
    admin
      .from("study_room_prayer_requests")
      .select("id,room_id,study_id,author_user_id,title,body,category,status,answered_at,answered_update,deleted_at,created_at,updated_at")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(30),
    admin
      .from("study_room_resources")
      .select("id,room_id,study_id,created_by_profile_id,title,description,external_url,resource_type,deleted_at,created_at,updated_at,profiles:created_by_profile_id(display_name,username)")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("resource_type", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(30),
    access.profile
      ? admin
          .from("study_room_bookmarks")
          .select("id,note_id,thread_id")
          .eq("room_id", roomId)
          .eq("profile_id", access.profile.id)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [
    studiesError,
    progressError,
    memberError,
    requestError,
    invitationError,
    noteError,
    threadError,
    prayerError,
    resourceError,
    bookmarkError,
  ]) {
    if (result) {
      throw new Error(result.message);
    }
  }

  const progressByStudy = new Map<string, StudyProgressStatus>(
    ((progressRows || []) as unknown as Record<string, unknown>[])
      .filter((row) => typeof row.study_id === "string" && typeof row.status === "string")
      .map((row) => [String(row.study_id), row.status as StudyProgressStatus]),
  );
  const completedCounts = new Map<string, number>();

  if (overview.viewer.canLead) {
    const studyIds = ((studiesRows || []) as unknown as Record<string, unknown>[])
      .map((row) => String(row.id))
      .filter(isStudyRoomUuid);

    if (studyIds.length > 0) {
      const { data: completions, error } = await admin
        .from("study_room_study_progress")
        .select("study_id")
        .eq("status", "completed")
        .in("study_id", studyIds);

      if (error) {
        throw new Error(error.message);
      }

      for (const row of (completions || []) as unknown as Record<string, unknown>[]) {
        const studyId = typeof row.study_id === "string" ? row.study_id : "";
        if (studyId) {
          completedCounts.set(studyId, (completedCounts.get(studyId) || 0) + 1);
        }
      }
    }
  }

  const studies = ((studiesRows || []) as unknown as Record<string, unknown>[]).map((row) =>
    normalizeStudy(row, progressByStudy, overview.viewer.canLead ? completedCounts : undefined),
  );
  const studyMap = new Map(studies.map((study) => [study.id, study]));
  const threadsRaw = (threadRows || []) as unknown as Record<string, unknown>[];
  const threadIds = threadsRaw.map((row) => String(row.id)).filter(isStudyRoomUuid);
  const { data: replyRows, error: replyError } = threadIds.length
    ? await admin
        .from("study_room_discussion_replies")
        .select("id,thread_id,author_user_id,body,deleted_at,created_at,updated_at")
        .in("thread_id", threadIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(120)
    : { data: [], error: null };

  if (replyError) {
    throw new Error(replyError.message);
  }

  const prayerIds = ((prayerRows || []) as unknown as Record<string, unknown>[]).map((row) => String(row.id)).filter(isStudyRoomUuid);
  const [{ data: supportRows, error: supportError }, { data: viewerSupportRows, error: viewerSupportError }] = await Promise.all([
    prayerIds.length
      ? admin.from("study_room_prayer_support").select("prayer_request_id").in("prayer_request_id", prayerIds)
      : Promise.resolve({ data: [], error: null }),
    prayerIds.length && access.profile
      ? admin
          .from("study_room_prayer_support")
          .select("prayer_request_id")
          .eq("profile_id", access.profile.id)
          .in("prayer_request_id", prayerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (supportError || viewerSupportError) {
    throw new Error((supportError || viewerSupportError)?.message || "Prayer support could not be loaded.");
  }

  const authorIds = [
    ...((noteRows || []) as unknown as Record<string, unknown>[]).map((row) => row.author_user_id),
    ...threadsRaw.map((row) => row.author_user_id),
    ...((replyRows || []) as unknown as Record<string, unknown>[]).map((row) => row.author_user_id),
    ...((prayerRows || []) as unknown as Record<string, unknown>[]).map((row) => row.author_user_id),
  ].filter((id): id is string => typeof id === "string" && isStudyRoomUuid(id));
  const authorMap = await getAuthorDisplayMap(authorIds);
  const noteBookmarks = new Set(
    ((bookmarkRows || []) as unknown as Record<string, unknown>[]).map((row) => row.note_id).filter((id): id is string => typeof id === "string"),
  );
  const threadBookmarks = new Set(
    ((bookmarkRows || []) as unknown as Record<string, unknown>[]).map((row) => row.thread_id).filter((id): id is string => typeof id === "string"),
  );
  const supportCounts = new Map<string, number>();
  for (const row of (supportRows || []) as unknown as Record<string, unknown>[]) {
    const prayerId = typeof row.prayer_request_id === "string" ? row.prayer_request_id : "";
    if (prayerId) supportCounts.set(prayerId, (supportCounts.get(prayerId) || 0) + 1);
  }
  const viewerSupports = new Set(
    ((viewerSupportRows || []) as unknown as Record<string, unknown>[]).map((row) => row.prayer_request_id).filter((id): id is string => typeof id === "string"),
  );
  const repliesByThread = new Map<string, StudyRoomDiscussionReply[]>();
  const viewerUserId = access.profile?.user_id || null;
  const canModerate = overview.viewer.canModerate;
  for (const row of (replyRows || []) as unknown as Record<string, unknown>[]) {
    const threadId = String(row.thread_id);
    const reply = normalizeAuthorContent(row, authorMap, viewerUserId, canModerate) as StudyRoomDiscussionReply;
    reply.thread_id = threadId;
    reply.body = String(row.body);
    repliesByThread.set(threadId, [...(repliesByThread.get(threadId) || []), reply]);
  }
  const notes = ((noteRows || []) as unknown as Record<string, unknown>[]).map((row) => {
    const study = typeof row.study_id === "string" ? studyMap.get(row.study_id) || null : null;
    return {
      ...normalizeAuthorContent(row, authorMap, viewerUserId, canModerate),
      room_id: String(row.room_id),
      study_id: typeof row.study_id === "string" ? row.study_id : null,
      study_title: study?.title || null,
      study_number: study?.study_number || null,
      title: String(row.title),
      body: String(row.body),
      scripture_reference: typeof row.scripture_reference === "string" ? row.scripture_reference : null,
      is_bookmarked: noteBookmarks.has(String(row.id)),
    };
  });
  const discussionThreads = threadsRaw.map((row) => {
    const study = typeof row.study_id === "string" ? studyMap.get(row.study_id) || null : null;
    return {
      ...normalizeAuthorContent(row, authorMap, viewerUserId, canModerate),
      room_id: String(row.room_id),
      study_id: typeof row.study_id === "string" ? row.study_id : null,
      study_title: study?.title || null,
      study_number: study?.study_number || null,
      title: String(row.title),
      body: String(row.body),
      is_pinned: row.is_pinned === true,
      is_locked: row.is_locked === true,
      is_bookmarked: threadBookmarks.has(String(row.id)),
      replies: repliesByThread.get(String(row.id)) || [],
    };
  });
  const prayerRequests = ((prayerRows || []) as unknown as Record<string, unknown>[]).map((row) => {
    const id = String(row.id);
    const study = typeof row.study_id === "string" ? studyMap.get(row.study_id) || null : null;
    const category = pickAllowedValue(String(row.category || "other"), STUDY_ROOM_PRAYER_CATEGORIES, "other");
    const status = pickAllowedValue(String(row.status || "active"), STUDY_ROOM_PRAYER_STATUSES, "active");
    return {
      ...normalizeAuthorContent(row, authorMap, viewerUserId, canModerate),
      room_id: String(row.room_id),
      study_id: typeof row.study_id === "string" ? row.study_id : null,
      study_title: study?.title || null,
      study_number: study?.study_number || null,
      title: String(row.title),
      body: String(row.body),
      category,
      status,
      answered_at: typeof row.answered_at === "string" ? row.answered_at : null,
      answered_update: typeof row.answered_update === "string" ? row.answered_update : null,
      support_count: supportCounts.get(id) || 0,
      viewer_supports: viewerSupports.has(id),
    };
  });
  const resourcesDetail = ((resourceRows || []) as unknown as Record<string, unknown>[]).map((row) => {
    const profile = row.profiles as Record<string, unknown> | null | undefined;
    const study = typeof row.study_id === "string" ? studyMap.get(row.study_id) || null : null;
    return {
      id: String(row.id),
      room_id: String(row.room_id),
      study_id: typeof row.study_id === "string" ? row.study_id : null,
      study_title: study?.title || null,
      study_number: study?.study_number || null,
      created_by_profile_id: typeof row.created_by_profile_id === "string" ? row.created_by_profile_id : null,
      creator_name:
        typeof profile?.display_name === "string" && profile.display_name
          ? profile.display_name
          : typeof profile?.username === "string" && profile.username
            ? profile.username
            : "Deleted user",
      title: String(row.title),
      description: typeof row.description === "string" ? row.description : null,
      external_url: String(row.external_url),
      resource_type: pickAllowedValue(String(row.resource_type || "external_link"), STUDY_ROOM_RESOURCE_TYPES, "external_link"),
      canEdit: overview.viewer.canLead,
      canModerate: overview.viewer.canModerate,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
    };
  });

  return {
    ...overview,
    studies,
    members: ((memberRows || []) as unknown as Record<string, unknown>[]).map((row) => {
      const profile = row.profiles as Record<string, unknown> | null | undefined;
      return {
        id: String(row.id),
        profile_id: String(row.profile_id),
        display_name:
          typeof profile?.display_name === "string" && profile.display_name
            ? profile.display_name
            : "Deleted user",
        username: typeof profile?.username === "string" ? profile.username : null,
        avatar_url: typeof profile?.avatar_url === "string" ? profile.avatar_url : null,
        role: row.role === "owner" || row.role === "leader" || row.role === "moderator" ? row.role : "member",
        created_at: String(row.created_at),
      };
    }),
    pendingJoinRequests: ((requestRows || []) as unknown as Record<string, unknown>[]).map((row) => {
      const profile = row.profiles as Record<string, unknown> | null | undefined;
      return {
        id: String(row.id),
        profile_id: String(row.profile_id),
        display_name:
          typeof profile?.display_name === "string" && profile.display_name
            ? profile.display_name
            : "Deleted user",
        message: typeof row.message === "string" ? row.message : null,
        created_at: String(row.created_at),
      };
    }),
    pendingInvitations: ((invitationRows || []) as unknown as Record<string, unknown>[]).map((row) => {
      const profile = row.profiles as Record<string, unknown> | null | undefined;
      return {
        id: String(row.id),
        invited_profile_id: String(row.invited_profile_id),
        display_name:
          typeof profile?.display_name === "string" && profile.display_name
            ? profile.display_name
            : "Deleted user",
        role: row.role === "leader" || row.role === "moderator" ? row.role : "member",
        message: typeof row.message === "string" ? row.message : null,
        created_at: String(row.created_at),
      };
    }),
    notes,
    discussionThreads,
    prayerRequests,
    resourcesDetail,
    savedNotes: notes.filter((note) => note.is_bookmarked),
    savedThreads: discussionThreads.filter((thread) => thread.is_bookmarked),
  };
}

async function getAuthorDisplayMap(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(isStudyRoomUuid)));
  const map = new Map<string, string>();

  if (uniqueIds.length === 0) {
    return map;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("user_id,display_name,username")
    .in("user_id", uniqueIds);

  if (error) {
    await logRequestEvent("warn", "study_room.author_lookup.failed", {
      operation: "author_lookup",
      ...getErrorMetadata(error),
    });
    return map;
  }

  for (const row of (data || []) as unknown as Record<string, unknown>[]) {
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    const displayName =
      typeof row.display_name === "string" && row.display_name
        ? row.display_name
        : typeof row.username === "string" && row.username
          ? row.username
          : "Selah Ember Member";

    if (userId) {
      map.set(userId, displayName);
    }
  }

  return map;
}

export async function createStudyRoom(formData: FormData) {
  const profile = await getRequiredStudyRoomProfile("/study-rooms/new");
  const name = getFormString(formData, "name");
  const description = getFormString(formData, "description");
  const visibility = pickAllowedValue(
    getFormString(formData, "visibility"),
    STUDY_ROOM_VISIBILITIES,
    "public",
  );
  const membershipMode = pickAllowedValue(
    getFormString(formData, "membership_mode"),
    STUDY_ROOM_MEMBERSHIP_MODES,
    "open_join",
  );
  const coverImageUrl = getOptionalFormString(formData, "cover_image_url", STUDY_ROOM_LIMITS.coverImageUrl);

  if (!name || !description) {
    redirect("/study-rooms/new?message=Room name and description are required.");
  }

  if (name.length > STUDY_ROOM_LIMITS.roomName) {
    redirect("/study-rooms/new?message=Room name must be 120 characters or fewer.");
  }

  if (description.length > STUDY_ROOM_LIMITS.roomDescription) {
    redirect("/study-rooms/new?message=Description must be 5000 characters or fewer.");
  }

  if (coverImageUrl && !isSafeHttpUrl(coverImageUrl)) {
    redirect("/study-rooms/new?message=Cover image must be a valid HTTP or HTTPS URL.");
  }

  const admin = createAdminClient();
  const { data: roomId, error } = await admin.rpc("create_study_room_with_owner", {
    room_name: name,
    room_description: description,
    room_cover_image_url: coverImageUrl,
    room_study_topic: getOptionalFormString(formData, "study_topic", STUDY_ROOM_LIMITS.studyTopic),
    room_primary_bible_book: getOptionalFormString(formData, "primary_bible_book", STUDY_ROOM_LIMITS.bibleBook),
    room_current_scripture_reference: getOptionalFormString(
      formData,
      "current_scripture_reference",
      STUDY_ROOM_LIMITS.scriptureReference,
    ),
    room_pinned_scripture_reference: getOptionalFormString(
      formData,
      "pinned_scripture_reference",
      STUDY_ROOM_LIMITS.scriptureReference,
    ),
    room_visibility: visibility,
    room_membership_mode: membershipMode,
    owner_profile_id: profile.id,
  });

  if (error) {
    redirect(`/study-rooms/new?message=${encodeMessage(error.message)}`);
  }

  if (!roomId || !isStudyRoomUuid(String(roomId))) {
    await logRequestEvent("error", "study_room.create_rpc.invalid_room_id", {
      operation: "create_study_room",
    });
    redirect("/study-rooms/new?message=Study Room could not be created.");
  }

  revalidatePath("/study-rooms");
  redirect(`/study-rooms/${roomId}`);
}

async function requireWritableStudyRoomMember(roomId: string, returnTo: string) {
  const access = await requireStudyRoomMembership(roomId);

  if (access.room?.status === "archived") {
    redirect(withMessage(returnTo, "Archived Study Rooms are read-only."));
  }

  if (!access.profile) {
    redirect("/signin");
  }

  return access;
}

async function requireWritableStudyRoomLeader(roomId: string, returnTo: string) {
  const access = await requireStudyRoomLeader(roomId);

  if (access.room?.status === "archived") {
    redirect(withMessage(returnTo, "Archived Study Rooms are read-only."));
  }

  return access;
}

async function requireWritableStudyRoomModerator(roomId: string, returnTo: string) {
  const access = await requireStudyRoomModerator(roomId);

  if (access.room?.status === "archived") {
    redirect(withMessage(returnTo, "Archived Study Rooms are read-only."));
  }

  return access;
}

async function insertStudyRoomModerationAudit(input: {
  roomId: string;
  actorProfileId: string | null;
  action: string;
  targetType: "room" | "member" | "join_request" | "invitation" | "note" | "thread" | "reply" | "prayer" | "resource" | "report";
  targetId: string | null;
  note?: string | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("study_room_moderation_audit").insert({
    room_id: input.roomId,
    report_id: null,
    actor_profile_id: input.actorProfileId,
    action: input.action.slice(0, 120),
    target_type: input.targetType,
    target_id: input.targetId,
    note: input.note ? input.note.slice(0, 500) : null,
  });

  if (error?.code === "42P01" || error?.code === "PGRST205") {
    await logRequestEvent("warn", "study_room.audit.unavailable", {
      operation: "study_room_audit",
      resourceType: "study_room",
      outcome: "failed",
    });
    return;
  }

  if (error) throw new Error(error.message);
}

async function logStudyRoomModeration(input: {
  roomId: string;
  actorProfileId: string | null;
  action: string;
  targetType: "room" | "member" | "join_request" | "invitation" | "note" | "thread" | "reply" | "prayer" | "resource" | "report";
  targetId: string | null;
  note?: string | null;
}) {
  await logRequestEvent("info", `study_room.${input.action}`, {
    operation: "study_room_moderation",
    resourceType: "study_room",
    outcome: "succeeded",
  });
  await insertStudyRoomModerationAudit(input);
}

async function assertAuthorOrModerator(
  access: Awaited<ReturnType<typeof requireWritableStudyRoomMember>>,
  authorUserId: string | null,
  returnTo: string,
) {
  if (!access.canModerate && (!authorUserId || access.profile?.user_id !== authorUserId)) {
    redirect(withMessage(returnTo, "You can only manage your own content."));
  }
}

async function getReplyForMutation(admin: ReturnType<typeof createAdminClient>, replyId: string, roomId: string) {
  const { data, error } = await admin
    .from("study_room_discussion_replies")
    .select("id,thread_id,author_user_id,study_room_discussion_threads:thread_id(room_id)")
    .eq("id", replyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const thread = data?.study_room_discussion_threads as Record<string, unknown> | null | undefined;
  if (!data || thread?.room_id !== roomId) return null;
  return data as { id: string; thread_id: string; author_user_id: string | null };
}

async function getScopedStudyId(admin: ReturnType<typeof createAdminClient>, roomId: string, rawStudyId: string, returnTo: string) {
  if (!rawStudyId) return null;
  if (!isStudyRoomUuid(rawStudyId)) {
    redirect(withMessage(returnTo, "Study not found."));
  }

  const { data, error } = await admin
    .from("study_room_studies")
    .select("id")
    .eq("id", rawStudyId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    redirect(withMessage(returnTo, "Study does not belong to this Study Room."));
  }

  return rawStudyId;
}

async function getContentRoomId(
  admin: ReturnType<typeof createAdminClient>,
  table: "study_room_notes" | "study_room_discussion_threads" | "study_room_prayer_requests" | "study_room_resources",
  targetId: string,
) {
  const { data, error } = await admin.from(table).select("room_id").eq("id", targetId).maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.room_id === "string" ? data.room_id : null;
}

export async function createStudyRoomNote(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=notes`);

  if (!isStudyRoomUuid(roomId)) redirect("/study-rooms?message=Study Room not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  if (!access.isMember) redirect(withMessage(returnTo, "Join this Study Room to participate."));
  const title = getFormString(formData, "title");
  const body = getFormString(formData, "body");

  if (!title || !body) redirect(withMessage(returnTo, "Note title and body are required."));
  if (title.length > STUDY_ROOM_LIMITS.noteTitle) redirect(withMessage(returnTo, "Note title must be 160 characters or fewer."));
  if (body.length > STUDY_ROOM_LIMITS.noteBody) redirect(withMessage(returnTo, "Note body is too long."));

  const admin = createAdminClient();
  const studyId = await getScopedStudyId(admin, roomId, getFormString(formData, "study_id"), returnTo);
  const { error } = await admin.from("study_room_notes").insert({
    room_id: roomId,
    study_id: studyId,
    author_user_id: access.profile?.user_id,
    title,
    body,
    scripture_reference: getOptionalFormString(formData, "scripture_reference", STUDY_ROOM_LIMITS.scriptureReference),
  });

  if (error) redirect(withMessage(returnTo, error.message));
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Note saved."));
}

export async function updateStudyRoomNote(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const noteId = getFormString(formData, "note_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=notes`);

  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(noteId)) redirect("/study-rooms?message=Note not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  const title = getFormString(formData, "title");
  const body = getFormString(formData, "body");
  if (!title || !body) redirect(withMessage(returnTo, "Note title and body are required."));

  const admin = createAdminClient();
  const { data: note, error: noteLookupError } = await admin
    .from("study_room_notes")
    .select("id,author_user_id")
    .eq("id", noteId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (noteLookupError) throw new Error(noteLookupError.message);
  if (!note) redirect(withMessage(returnTo, "Note not found."));
  await assertAuthorOrModerator(access, typeof note.author_user_id === "string" ? note.author_user_id : null, returnTo);
  const studyId = await getScopedStudyId(admin, roomId, getFormString(formData, "study_id"), returnTo);
  const { error } = await admin
    .from("study_room_notes")
    .update({
      title: title.slice(0, STUDY_ROOM_LIMITS.noteTitle),
      body: body.slice(0, STUDY_ROOM_LIMITS.noteBody),
      study_id: studyId,
      scripture_reference: getOptionalFormString(formData, "scripture_reference", STUDY_ROOM_LIMITS.scriptureReference),
    })
    .eq("id", noteId)
    .eq("room_id", roomId);

  if (error) redirect(withMessage(returnTo, error.message));
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Note updated."));
}

export async function deleteStudyRoomNote(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const noteId = getFormString(formData, "note_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=notes`);

  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(noteId)) redirect("/study-rooms?message=Note not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  const admin = createAdminClient();
  const { data: note, error: noteLookupError } = await admin
    .from("study_room_notes")
    .select("id,author_user_id")
    .eq("id", noteId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (noteLookupError) throw new Error(noteLookupError.message);
  if (!note) redirect(withMessage(returnTo, "Note not found."));
  await assertAuthorOrModerator(access, typeof note.author_user_id === "string" ? note.author_user_id : null, returnTo);
  const { error } = await admin.from("study_room_notes").update({ deleted_at: new Date().toISOString() }).eq("id", noteId).eq("room_id", roomId);
  if (error) redirect(withMessage(returnTo, error.message));
  if (access.canModerate && note.author_user_id !== access.profile?.user_id) {
    await logStudyRoomModeration({
      roomId,
      actorProfileId: access.profile?.id || null,
      action: "moderator_note_removed",
      targetType: "note",
      targetId: noteId,
    });
  }
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Note removed."));
}

export async function toggleStudyRoomBookmark(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const targetType = getFormString(formData, "target_type");
  const targetId = getFormString(formData, "target_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}`);

  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(targetId) || (targetType !== "note" && targetType !== "thread")) {
    redirect("/study-rooms?message=Bookmark target not found.");
  }

  const access = await requireStudyRoomMembership(roomId);
  if (!access.isMember) redirect(withMessage(returnTo, "Join this Study Room to participate."));
  if (!access.profile) redirect("/signin");
  const admin = createAdminClient();
  const targetRoomId = targetType === "note"
    ? await getContentRoomId(admin, "study_room_notes", targetId)
    : await getContentRoomId(admin, "study_room_discussion_threads", targetId);
  if (targetRoomId !== roomId) redirect(withMessage(returnTo, "Bookmark target not found."));

  const match = targetType === "note" ? { note_id: targetId } : { thread_id: targetId };
  const { data: existing, error: lookupError } = await admin
    .from("study_room_bookmarks")
    .select("id")
    .eq("room_id", roomId)
    .eq("profile_id", access.profile.id)
    .match(match)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  const result = existing
    ? await admin.from("study_room_bookmarks").delete().eq("id", existing.id)
    : await admin.from("study_room_bookmarks").insert({
        room_id: roomId,
        profile_id: access.profile.id,
        note_id: targetType === "note" ? targetId : null,
        thread_id: targetType === "thread" ? targetId : null,
      });

  if (result.error) redirect(withMessage(returnTo, result.error.message));
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, existing ? "Removed from saved items." : "Saved privately."));
}

export async function createStudyRoomDiscussionThread(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=discussion`);
  if (!isStudyRoomUuid(roomId)) redirect("/study-rooms?message=Study Room not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  if (!access.isMember) redirect(withMessage(returnTo, "Join this Study Room to participate."));
  const title = getFormString(formData, "title");
  const body = getFormString(formData, "body");
  if (!title || !body) redirect(withMessage(returnTo, "Discussion title and body are required."));

  const admin = createAdminClient();
  const studyId = await getScopedStudyId(admin, roomId, getFormString(formData, "study_id"), returnTo);
  const { error } = await admin.from("study_room_discussion_threads").insert({
    room_id: roomId,
    study_id: studyId,
    author_user_id: access.profile?.user_id,
    title: title.slice(0, STUDY_ROOM_LIMITS.discussionTitle),
    body: body.slice(0, STUDY_ROOM_LIMITS.discussionBody),
  });
  if (error) redirect(withMessage(returnTo, error.message));
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Discussion started."));
}

export async function updateStudyRoomDiscussionThread(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const threadId = getFormString(formData, "thread_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=discussion`);
  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(threadId)) redirect("/study-rooms?message=Discussion not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  const title = getFormString(formData, "title");
  const body = getFormString(formData, "body");
  if (!title || !body) redirect(withMessage(returnTo, "Discussion title and body are required."));

  const admin = createAdminClient();
  const { data: thread, error: threadLookupError } = await admin
    .from("study_room_discussion_threads")
    .select("id,author_user_id")
    .eq("id", threadId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (threadLookupError) throw new Error(threadLookupError.message);
  if (!thread) redirect(withMessage(returnTo, "Discussion not found."));
  await assertAuthorOrModerator(access, typeof thread.author_user_id === "string" ? thread.author_user_id : null, returnTo);
  const studyId = await getScopedStudyId(admin, roomId, getFormString(formData, "study_id"), returnTo);
  const { error } = await admin.from("study_room_discussion_threads").update({
    title: title.slice(0, STUDY_ROOM_LIMITS.discussionTitle),
    body: body.slice(0, STUDY_ROOM_LIMITS.discussionBody),
    study_id: studyId,
  }).eq("id", threadId).eq("room_id", roomId);
  if (error) redirect(withMessage(returnTo, error.message));
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Discussion updated."));
}

export async function deleteStudyRoomDiscussionThread(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const threadId = getFormString(formData, "thread_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=discussion`);
  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(threadId)) redirect("/study-rooms?message=Discussion not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  const admin = createAdminClient();
  const { data: thread, error: threadLookupError } = await admin
    .from("study_room_discussion_threads")
    .select("id,author_user_id")
    .eq("id", threadId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (threadLookupError) throw new Error(threadLookupError.message);
  if (!thread) redirect(withMessage(returnTo, "Discussion not found."));
  await assertAuthorOrModerator(access, typeof thread.author_user_id === "string" ? thread.author_user_id : null, returnTo);
  const { error } = await admin.from("study_room_discussion_threads").update({ deleted_at: new Date().toISOString() }).eq("id", threadId).eq("room_id", roomId);
  if (error) redirect(withMessage(returnTo, error.message));
  if (access.canModerate && thread.author_user_id !== access.profile?.user_id) {
    await logStudyRoomModeration({
      roomId,
      actorProfileId: access.profile?.id || null,
      action: "moderator_thread_removed",
      targetType: "thread",
      targetId: threadId,
    });
  }
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Discussion removed."));
}

export async function createStudyRoomDiscussionReply(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const threadId = getFormString(formData, "thread_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=discussion`);
  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(threadId)) redirect("/study-rooms?message=Discussion not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  if (!access.isMember) redirect(withMessage(returnTo, "Join this Study Room to participate."));
  const body = getFormString(formData, "body");
  if (!body) redirect(withMessage(returnTo, "Reply body is required."));

  const admin = createAdminClient();
  const { data: thread, error: threadError } = await admin
    .from("study_room_discussion_threads")
    .select("id,room_id,title,author_user_id,is_locked")
    .eq("id", threadId)
    .eq("room_id", roomId)
    .is("deleted_at", null)
    .maybeSingle();
  if (threadError) throw new Error(threadError.message);
  if (!thread) redirect(withMessage(returnTo, "Discussion not found."));
  if (thread.is_locked) redirect(withMessage(returnTo, "This discussion is locked."));

  const { error } = await admin.from("study_room_discussion_replies").insert({
    thread_id: threadId,
    author_user_id: access.profile?.user_id,
    body: body.slice(0, STUDY_ROOM_LIMITS.discussionReplyBody),
  });
  if (error) redirect(withMessage(returnTo, error.message));

  await createNotification({
    userId: typeof thread.author_user_id === "string" ? thread.author_user_id : null,
    actorUserId: access.profile?.user_id,
    type: "study_room_discussion_reply",
    title: "New reply in your Study Room discussion",
    body: String(thread.title),
    href: `/study-rooms/${roomId}?section=discussion#thread-${threadId}`,
  });

  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Reply posted."));
}

export async function updateStudyRoomDiscussionReply(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const replyId = getFormString(formData, "reply_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=discussion`);
  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(replyId)) redirect("/study-rooms?message=Reply not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  const body = getFormString(formData, "body");
  if (!body) redirect(withMessage(returnTo, "Reply body is required."));

  const admin = createAdminClient();
  const reply = await getReplyForMutation(admin, replyId, roomId);
  if (!reply) redirect(withMessage(returnTo, "Reply not found."));
  await assertAuthorOrModerator(access, typeof reply.author_user_id === "string" ? reply.author_user_id : null, returnTo);
  const { error } = await admin.from("study_room_discussion_replies").update({ body: body.slice(0, STUDY_ROOM_LIMITS.discussionReplyBody) }).eq("id", replyId).eq("thread_id", reply.thread_id);
  if (error) redirect(withMessage(returnTo, error.message));
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Reply updated."));
}

export async function deleteStudyRoomDiscussionReply(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const replyId = getFormString(formData, "reply_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=discussion`);
  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(replyId)) redirect("/study-rooms?message=Reply not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  const admin = createAdminClient();
  const reply = await getReplyForMutation(admin, replyId, roomId);
  if (!reply) redirect(withMessage(returnTo, "Reply not found."));
  await assertAuthorOrModerator(access, typeof reply.author_user_id === "string" ? reply.author_user_id : null, returnTo);
  const { error } = await admin.from("study_room_discussion_replies").update({ deleted_at: new Date().toISOString() }).eq("id", replyId).eq("thread_id", reply.thread_id);
  if (error) redirect(withMessage(returnTo, error.message));
  if (access.canModerate && reply.author_user_id !== access.profile?.user_id) {
    await logStudyRoomModeration({
      roomId,
      actorProfileId: access.profile?.id || null,
      action: "moderator_reply_removed",
      targetType: "reply",
      targetId: replyId,
    });
  }
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Reply removed."));
}

export async function updateStudyRoomDiscussionModeration(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const threadId = getFormString(formData, "thread_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=discussion`);
  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(threadId)) redirect("/study-rooms?message=Discussion not found.");
  const access = await requireWritableStudyRoomModerator(roomId, returnTo);
  if (!access.canModerate) redirect(withMessage(returnTo, "Only room moderators can do that."));

  const admin = createAdminClient();
  const { data: thread, error: threadLookupError } = await admin
    .from("study_room_discussion_threads")
    .select("id,is_pinned,is_locked")
    .eq("id", threadId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (threadLookupError) throw new Error(threadLookupError.message);
  if (!thread) redirect(withMessage(returnTo, "Discussion not found."));
  const nextPinned = getFormString(formData, "is_pinned") === "on";
  const nextLocked = getFormString(formData, "is_locked") === "on";
  const { error } = await admin.from("study_room_discussion_threads").update({
    is_pinned: nextPinned,
    is_locked: nextLocked,
  }).eq("id", threadId).eq("room_id", roomId);
  if (error) redirect(withMessage(returnTo, error.message));
  await logStudyRoomModeration({
    roomId,
    actorProfileId: access.profile?.id || null,
    action: "moderator_thread_pin_lock",
    targetType: "thread",
    targetId: threadId,
    note: `pinned:${nextPinned};locked:${nextLocked}`,
  });
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Discussion moderation updated."));
}

export async function createStudyRoomPrayerRequest(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=prayer`);
  if (!isStudyRoomUuid(roomId)) redirect("/study-rooms?message=Study Room not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  if (!access.isMember) redirect(withMessage(returnTo, "Join this Study Room to participate."));
  const title = getFormString(formData, "title");
  const body = getFormString(formData, "body");
  if (!title || !body) redirect(withMessage(returnTo, "Prayer title and body are required."));

  const admin = createAdminClient();
  const studyId = await getScopedStudyId(admin, roomId, getFormString(formData, "study_id"), returnTo);
  const { error } = await admin.from("study_room_prayer_requests").insert({
    room_id: roomId,
    study_id: studyId,
    author_user_id: access.profile?.user_id,
    title: title.slice(0, STUDY_ROOM_LIMITS.prayerTitle),
    body: body.slice(0, STUDY_ROOM_LIMITS.prayerBody),
    category: pickAllowedValue(getFormString(formData, "category"), STUDY_ROOM_PRAYER_CATEGORIES, "other"),
  });
  if (error) redirect(withMessage(returnTo, error.message));
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Prayer request shared."));
}

export async function updateStudyRoomPrayerRequest(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const prayerId = getFormString(formData, "prayer_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=prayer`);
  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(prayerId)) redirect("/study-rooms?message=Prayer request not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  const title = getFormString(formData, "title");
  const body = getFormString(formData, "body");
  if (!title || !body) redirect(withMessage(returnTo, "Prayer title and body are required."));

  const admin = createAdminClient();
  const { data: prayer, error: prayerLookupError } = await admin
    .from("study_room_prayer_requests")
    .select("id,author_user_id")
    .eq("id", prayerId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (prayerLookupError) throw new Error(prayerLookupError.message);
  if (!prayer) redirect(withMessage(returnTo, "Prayer request not found."));
  await assertAuthorOrModerator(access, typeof prayer.author_user_id === "string" ? prayer.author_user_id : null, returnTo);
  const studyId = await getScopedStudyId(admin, roomId, getFormString(formData, "study_id"), returnTo);
  const { error } = await admin.from("study_room_prayer_requests").update({
    title: title.slice(0, STUDY_ROOM_LIMITS.prayerTitle),
    body: body.slice(0, STUDY_ROOM_LIMITS.prayerBody),
    study_id: studyId,
    category: pickAllowedValue(getFormString(formData, "category"), STUDY_ROOM_PRAYER_CATEGORIES, "other"),
  }).eq("id", prayerId).eq("room_id", roomId);
  if (error) redirect(withMessage(returnTo, error.message));
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Prayer request updated."));
}

export async function deleteStudyRoomPrayerRequest(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const prayerId = getFormString(formData, "prayer_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=prayer`);
  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(prayerId)) redirect("/study-rooms?message=Prayer request not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  const admin = createAdminClient();
  const { data: prayer, error: prayerLookupError } = await admin
    .from("study_room_prayer_requests")
    .select("id,author_user_id")
    .eq("id", prayerId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (prayerLookupError) throw new Error(prayerLookupError.message);
  if (!prayer) redirect(withMessage(returnTo, "Prayer request not found."));
  await assertAuthorOrModerator(access, typeof prayer.author_user_id === "string" ? prayer.author_user_id : null, returnTo);
  const { error } = await admin.from("study_room_prayer_requests").update({ status: "removed", deleted_at: new Date().toISOString() }).eq("id", prayerId).eq("room_id", roomId);
  if (error) redirect(withMessage(returnTo, error.message));
  if (access.canModerate && prayer.author_user_id !== access.profile?.user_id) {
    await logStudyRoomModeration({
      roomId,
      actorProfileId: access.profile?.id || null,
      action: "moderator_prayer_removed",
      targetType: "prayer",
      targetId: prayerId,
    });
  }
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Prayer request removed."));
}

export async function toggleStudyRoomPrayerSupport(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const prayerId = getFormString(formData, "prayer_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=prayer`);
  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(prayerId)) redirect("/study-rooms?message=Prayer request not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  if (!access.isMember) redirect(withMessage(returnTo, "Join this Study Room to participate."));
  const admin = createAdminClient();
  const targetRoomId = await getContentRoomId(admin, "study_room_prayer_requests", prayerId);
  if (targetRoomId !== roomId) redirect(withMessage(returnTo, "Prayer request not found."));

  const { data: existing, error: lookupError } = await admin
    .from("study_room_prayer_support")
    .select("id")
    .eq("prayer_request_id", prayerId)
    .eq("profile_id", access.profile?.id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  const result = existing
    ? await admin.from("study_room_prayer_support").delete().eq("id", existing.id)
    : await admin.from("study_room_prayer_support").insert({ prayer_request_id: prayerId, profile_id: access.profile?.id });
  if (result.error) redirect(withMessage(returnTo, result.error.message));
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, existing ? "Prayer acknowledgement removed." : "Prayer acknowledged."));
}

export async function markStudyRoomPrayerAnswered(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const prayerId = getFormString(formData, "prayer_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=prayer`);
  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(prayerId)) redirect("/study-rooms?message=Prayer request not found.");
  const access = await requireWritableStudyRoomMember(roomId, returnTo);
  const admin = createAdminClient();
  const { data: prayer, error: lookupError } = await admin
    .from("study_room_prayer_requests")
    .select("id,room_id,title,author_user_id")
    .eq("id", prayerId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (!prayer) redirect(withMessage(returnTo, "Prayer request not found."));
  await assertAuthorOrModerator(access, typeof prayer.author_user_id === "string" ? prayer.author_user_id : null, returnTo);

  const { error } = await admin.from("study_room_prayer_requests").update({
    status: "answered",
    answered_at: new Date().toISOString(),
    answered_update: getOptionalFormString(formData, "answered_update", STUDY_ROOM_LIMITS.prayerAnsweredUpdate),
  }).eq("id", prayerId).eq("room_id", roomId);
  if (error) redirect(withMessage(returnTo, error.message));

  await createNotification({
    userId: typeof prayer.author_user_id === "string" ? prayer.author_user_id : null,
    actorUserId: access.profile?.user_id,
    type: "study_room_prayer_answered",
    title: "Prayer request marked answered",
    body: String(prayer.title),
    href: `/study-rooms/${roomId}?section=prayer#prayer-${prayerId}`,
  });

  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Prayer request marked answered."));
}

export async function createStudyRoomResource(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=resources`);
  if (!isStudyRoomUuid(roomId)) redirect("/study-rooms?message=Study Room not found.");
  const access = await requireWritableStudyRoomLeader(roomId, returnTo);
  const title = getFormString(formData, "title");
  const externalUrl = getFormString(formData, "external_url");
  if (!title || !externalUrl) redirect(withMessage(returnTo, "Resource title and URL are required."));
  if (!isSafeHttpUrl(externalUrl)) redirect(withMessage(returnTo, "Resource URL must use HTTP or HTTPS."));

  const admin = createAdminClient();
  const studyId = await getScopedStudyId(admin, roomId, getFormString(formData, "study_id"), returnTo);
  const { error } = await admin.from("study_room_resources").insert({
    room_id: roomId,
    study_id: studyId,
    created_by_profile_id: access.profile?.id,
    title: title.slice(0, STUDY_ROOM_LIMITS.resourceTitle),
    description: getOptionalFormString(formData, "description", STUDY_ROOM_LIMITS.resourceDescription),
    external_url: externalUrl.slice(0, STUDY_ROOM_LIMITS.coverImageUrl),
    resource_type: pickAllowedValue(getFormString(formData, "resource_type"), STUDY_ROOM_RESOURCE_TYPES, "external_link"),
  });
  if (error) redirect(withMessage(returnTo, error.message));
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Resource added."));
}

export async function updateStudyRoomResource(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const resourceId = getFormString(formData, "resource_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=resources`);
  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(resourceId)) redirect("/study-rooms?message=Resource not found.");
  await requireWritableStudyRoomLeader(roomId, returnTo);
  const title = getFormString(formData, "title");
  const externalUrl = getFormString(formData, "external_url");
  if (!title || !externalUrl) redirect(withMessage(returnTo, "Resource title and URL are required."));
  if (!isSafeHttpUrl(externalUrl)) redirect(withMessage(returnTo, "Resource URL must use HTTP or HTTPS."));

  const admin = createAdminClient();
  const studyId = await getScopedStudyId(admin, roomId, getFormString(formData, "study_id"), returnTo);
  const { error } = await admin.from("study_room_resources").update({
    study_id: studyId,
    title: title.slice(0, STUDY_ROOM_LIMITS.resourceTitle),
    description: getOptionalFormString(formData, "description", STUDY_ROOM_LIMITS.resourceDescription),
    external_url: externalUrl.slice(0, STUDY_ROOM_LIMITS.coverImageUrl),
    resource_type: pickAllowedValue(getFormString(formData, "resource_type"), STUDY_ROOM_RESOURCE_TYPES, "external_link"),
  }).eq("id", resourceId).eq("room_id", roomId);
  if (error) redirect(withMessage(returnTo, error.message));
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Resource updated."));
}

export async function deleteStudyRoomResource(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const resourceId = getFormString(formData, "resource_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}?section=resources`);
  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(resourceId)) redirect("/study-rooms?message=Resource not found.");
  const access = await requireWritableStudyRoomModerator(roomId, returnTo);
  const admin = createAdminClient();
  const { data: resource, error: lookupError } = await admin
    .from("study_room_resources")
    .select("id,created_by_profile_id")
    .eq("id", resourceId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (!resource) redirect(withMessage(returnTo, "Resource not found."));
  const { error } = await admin.from("study_room_resources").update({ deleted_at: new Date().toISOString() }).eq("id", resourceId).eq("room_id", roomId);
  if (error) redirect(withMessage(returnTo, error.message));
  await logStudyRoomModeration({
    roomId,
    actorProfileId: access.profile?.id || null,
    action: "moderator_resource_removed",
    targetType: "resource",
    targetId: resourceId,
  });
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Resource removed."));
}

export async function reportStudyRoomContent(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const targetType = pickAllowedValue(getFormString(formData, "target_type"), STUDY_ROOM_REPORT_TARGETS, "note");
  const targetId = getFormString(formData, "target_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}`);
  const reason = getFormString(formData, "reason");

  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(targetId)) redirect("/study-rooms?message=Report target not found.");
  if (!reason) redirect(withMessage(returnTo, "Report reason is required."));
  const access = await requireStudyRoomMembership(roomId);
  if (!access.isMember) redirect(withMessage(returnTo, "Join this Study Room to participate."));
  if (!access.profile) redirect("/signin");
  const admin = createAdminClient();
  const columnByTarget: Record<StudyRoomReportTarget, string> = {
    note: "note_id",
    thread: "thread_id",
    reply: "reply_id",
    prayer: "prayer_request_id",
    resource: "resource_id",
  };
  const targetColumn = columnByTarget[targetType];
  const duplicateQuery = admin
    .from("study_room_reports")
    .select("id")
    .eq("room_id", roomId)
    .eq("reporter_user_id", access.profile.user_id)
    .eq("status", "open")
    .eq(targetColumn, targetId)
    .maybeSingle();
  const { data: duplicate, error: duplicateError } = await duplicateQuery;
  if (duplicateError) throw new Error(duplicateError.message);
  if (duplicate) redirect(withMessage(returnTo, "You already reported this item."));

  const insertPayload = {
    reporter_user_id: access.profile.user_id,
    room_id: roomId,
    note_id: targetType === "note" ? targetId : null,
    thread_id: targetType === "thread" ? targetId : null,
    reply_id: targetType === "reply" ? targetId : null,
    prayer_request_id: targetType === "prayer" ? targetId : null,
    resource_id: targetType === "resource" ? targetId : null,
    reason: reason.slice(0, STUDY_ROOM_LIMITS.reportReason),
    details: getOptionalFormString(formData, "details", STUDY_ROOM_LIMITS.reportDetails),
  };
  const { error } = await admin.from("study_room_reports").insert(insertPayload);
  if (error) redirect(withMessage(returnTo, error.message));
  redirect(withMessage(returnTo, "Report submitted."));
}

export async function searchStudyRoomInviteProfiles(roomId: string, query: string): Promise<StudyRoomInviteSearchResult[]> {
  if (!isStudyRoomUuid(roomId)) return [];
  await requireStudyRoomLeader(roomId);
  const term = query.trim().slice(0, STUDY_ROOM_LIMITS.inviteSearch);
  if (term.length < 3) return [];

  const admin = createAdminClient();
  const [{ data: members, error: membersError }, { data: invitations, error: invitationsError }] = await Promise.all([
    admin.from("study_room_members").select("profile_id").eq("room_id", roomId),
    admin.from("study_room_invitations").select("invited_profile_id").eq("room_id", roomId).eq("status", "pending"),
  ]);
  if (membersError || invitationsError) throw new Error((membersError || invitationsError)?.message || "Invite search failed.");

  const excluded = new Set([
    ...((members || []) as unknown as Record<string, unknown>[]).map((row) => row.profile_id),
    ...((invitations || []) as unknown as Record<string, unknown>[]).map((row) => row.invited_profile_id),
  ].filter((id): id is string => typeof id === "string"));
  const escaped = term.replace(/[,%()]/g, " ");
  let queryBuilder = admin
    .from("profiles")
    .select("id,display_name,username,avatar_url")
    .or(`display_name.ilike.%${escaped}%,username.ilike.%${escaped}%`)
    .limit(8);

  if (excluded.size > 0) {
    queryBuilder = queryBuilder.not("id", "in", `(${Array.from(excluded).join(",")})`);
  }

  const { data, error } = await queryBuilder;
  if (error) throw new Error(error.message);

  return ((data || []) as unknown as Record<string, unknown>[])
    .filter((row) => typeof row.id === "string" && isStudyRoomUuid(row.id) && typeof row.display_name === "string")
    .map((row) => ({
      id: String(row.id),
      display_name: String(row.display_name),
      username: typeof row.username === "string" ? row.username : null,
      avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
    }));
}

export async function updateStudyRoomSettings(formData: FormData) {
  const roomId = getFormString(formData, "room_id");

  if (!isStudyRoomUuid(roomId)) {
    redirect("/study-rooms?message=Study Room not found.");
  }

  await requireStudyRoomLeader(roomId);
  const name = getFormString(formData, "name");
  const description = getFormString(formData, "description");
  const coverImageUrl = getOptionalFormString(formData, "cover_image_url", STUDY_ROOM_LIMITS.coverImageUrl);
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}`);

  if (!name || !description) {
    redirect(withMessage(returnTo, "Room name and description are required."));
  }

  if (coverImageUrl && !isSafeHttpUrl(coverImageUrl)) {
    redirect(withMessage(returnTo, "Cover image must be a valid HTTP or HTTPS URL."));
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("study_rooms")
    .update({
      name: name.slice(0, STUDY_ROOM_LIMITS.roomName),
      description: description.slice(0, STUDY_ROOM_LIMITS.roomDescription),
      cover_image_url: coverImageUrl,
      study_topic: getOptionalFormString(formData, "study_topic", STUDY_ROOM_LIMITS.studyTopic),
      primary_bible_book: getOptionalFormString(formData, "primary_bible_book", STUDY_ROOM_LIMITS.bibleBook),
      current_scripture_reference: getOptionalFormString(
        formData,
        "current_scripture_reference",
        STUDY_ROOM_LIMITS.scriptureReference,
      ),
      pinned_scripture_reference: getOptionalFormString(
        formData,
        "pinned_scripture_reference",
        STUDY_ROOM_LIMITS.scriptureReference,
      ),
      visibility: pickAllowedValue(getFormString(formData, "visibility"), STUDY_ROOM_VISIBILITIES, "public"),
      membership_mode: pickAllowedValue(
        getFormString(formData, "membership_mode"),
        STUDY_ROOM_MEMBERSHIP_MODES,
        "open_join",
      ),
      status: pickAllowedValue(getFormString(formData, "status"), STUDY_ROOM_STATUSES, "active"),
    })
    .eq("id", roomId);

  if (error) {
    redirect(withMessage(returnTo, error.message));
  }

  revalidatePath("/study-rooms");
  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Study Room updated."));
}

export async function updatePinnedScripture(formData: FormData) {
  const roomId = getFormString(formData, "room_id");

  if (!isStudyRoomUuid(roomId)) {
    redirect("/study-rooms?message=Study Room not found.");
  }

  await requireStudyRoomLeader(roomId);
  const scriptureReference = getOptionalFormString(
    formData,
    "pinned_scripture_reference",
    STUDY_ROOM_LIMITS.scriptureReference,
  );
  const admin = createAdminClient();
  const { error } = await admin
    .from("study_rooms")
    .update({ pinned_scripture_reference: scriptureReference })
    .eq("id", roomId);

  if (error) {
    redirect(`/study-rooms/${roomId}?message=${encodeMessage(error.message)}`);
  }

  revalidatePath(`/study-rooms/${roomId}`);
  redirect(`/study-rooms/${roomId}?message=Today's Scripture updated.`);
}

export async function joinStudyRoom(formData: FormData) {
  const roomId = getFormString(formData, "room_id");

  if (!isStudyRoomUuid(roomId)) {
    redirect("/study-rooms?message=Study Room not found.");
  }

  const profile = await getRequiredStudyRoomProfile(`/study-rooms/${roomId}`);
  const access = await getStudyRoomAccess(roomId);

  if (!access.room) {
    redirect("/study-rooms?message=Study Room not found.");
  }

  if (access.isMember) {
    redirect(`/study-rooms/${roomId}`);
  }

  if (access.room.status !== "active") {
    redirect(`/study-rooms/${roomId}?message=This Study Room is not open for new members.`);
  }

  const admin = createAdminClient();

  if (access.room.membership_mode === "open_join") {
    const { error } = await admin.from("study_room_members").upsert(
      {
        room_id: roomId,
        profile_id: profile.id,
        role: "member",
      },
      { onConflict: "room_id,profile_id", ignoreDuplicates: true },
    );

    if (error) {
      redirect(`/study-rooms/${roomId}?message=${encodeMessage(error.message)}`);
    }

    await notifyRoomLeaders(roomId, profile.user_id, {
      type: "study_room_member_joined",
      title: "New Study Room member",
      body: `${profile.display_name} joined ${access.room.name}.`,
      href: `/study-rooms/${roomId}`,
    });

    revalidatePath("/study-rooms");
    revalidatePath(`/study-rooms/${roomId}`);
    redirect(`/study-rooms/${roomId}?message=You joined this Study Room.`);
  }

  if (access.room.membership_mode === "request_to_join") {
    const message = getOptionalFormString(formData, "message", STUDY_ROOM_LIMITS.joinRequestMessage);
    const { error } = await admin.from("study_room_join_requests").insert({
        room_id: roomId,
        profile_id: profile.id,
        message,
        status: "pending",
      });

    if (error) {
      const messageText = error.code === "23505" ? "A join request is already pending." : error.message;
      redirect(`/study-rooms/${roomId}?message=${encodeMessage(messageText)}`);
    }

    await notifyRoomLeaders(roomId, profile.user_id, {
      type: "study_room_join_request",
      title: "Study Room join request",
      body: `${profile.display_name} requested to join ${access.room.name}.`,
      href: `/study-rooms/${roomId}`,
    });

    revalidatePath(`/study-rooms/${roomId}`);
    redirect(`/study-rooms/${roomId}?message=Join request sent.`);
  }

  redirect(`/study-rooms/${roomId}?message=This Study Room is invite only.`);
}

export async function leaveStudyRoom(formData: FormData) {
  const roomId = getFormString(formData, "room_id");

  if (!isStudyRoomUuid(roomId)) {
    redirect("/study-rooms?message=Study Room not found.");
  }

  const access = await requireStudyRoomMembership(roomId);

  if (access.role === "owner") {
    redirect(`/study-rooms/${roomId}?message=Transfer ownership before leaving this Study Room.`);
  }

  if (!access.profile) {
    redirect("/signin");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("study_room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("profile_id", access.profile.id);

  if (error) {
    redirect(`/study-rooms/${roomId}?message=${encodeMessage(error.message)}`);
  }

  revalidatePath("/study-rooms");
  revalidatePath(`/study-rooms/${roomId}`);
  redirect("/study-rooms?message=You left the Study Room.");
}

export async function reviewStudyRoomJoinRequest(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const requestId = getFormString(formData, "request_id");
  const decision = getFormString(formData, "decision");

  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(requestId)) {
    redirect("/study-rooms?message=Join request not found.");
  }

  const access = await requireStudyRoomLeader(roomId);
  const admin = createAdminClient();
  const { data: request, error: requestError } = await admin
    .from("study_room_join_requests")
    .select("id,profile_id,status,profiles:profile_id(user_id,display_name)")
    .eq("id", requestId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (requestError) {
    throw new Error(requestError.message);
  }

  if (!request || request.status !== "pending") {
    redirect(`/study-rooms/${roomId}?message=Join request is no longer pending.`);
  }

  const approved = decision === "approve";
  const { error: reviewError } = await admin.rpc("review_study_room_join_request", {
    target_request_id: requestId,
    reviewer_profile_id: access.profile?.id,
    approve_request: approved,
  });

  if (reviewError) {
    redirect(`/study-rooms/${roomId}?message=${encodeMessage(reviewError.message)}`);
  }

  await logStudyRoomModeration({
    roomId,
    actorProfileId: access.profile?.id || null,
    action: approved ? "join_request_approved" : "join_request_denied",
    targetType: "join_request",
    targetId: requestId,
  });

  const requesterProfile = request.profiles as { user_id?: string } | null | undefined;
  await createNotification({
    userId: requesterProfile?.user_id,
    actorUserId: access.profile?.user_id,
    type: approved ? "study_room_join_approved" : "study_room_join_denied",
    title: approved ? "Study Room request approved" : "Study Room request declined",
    body: access.room ? `${access.room.name}: ${approved ? "your request was approved." : "your request was declined."}` : null,
    href: `/study-rooms/${roomId}`,
  });

  revalidatePath(`/study-rooms/${roomId}`);
  redirect(`/study-rooms/${roomId}?message=${approved ? "Join request approved." : "Join request declined."}`);
}

export async function inviteStudyRoomMember(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const profileId = getFormString(formData, "profile_id");

  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(profileId)) {
    redirect("/study-rooms?message=Invitation target not found.");
  }

  const access = await requireStudyRoomLeader(roomId);
  const role = pickAllowedValue(getFormString(formData, "role"), STUDY_ROOM_ROLES, "member");

  if (role === "owner") {
    redirect(`/study-rooms/${roomId}?message=Use ownership transfer for owner changes.`);
  }

  const admin = createAdminClient();
  const { data: targetProfile, error: targetError } = await admin
    .from("profiles")
    .select("id,user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (targetError) {
    throw new Error(targetError.message);
  }

  if (!targetProfile) {
    redirect(`/study-rooms/${roomId}?message=User profile not found.`);
  }

  const { error } = await admin.from("study_room_invitations").insert({
      room_id: roomId,
      invited_profile_id: profileId,
      invited_by_profile_id: access.profile?.id || null,
      role,
      status: "pending",
      message: getOptionalFormString(formData, "message", STUDY_ROOM_LIMITS.invitationMessage),
    });

  if (error) {
    const messageText = error.code === "23505" ? "An invitation is already pending." : error.message;
    redirect(`/study-rooms/${roomId}?message=${encodeMessage(messageText)}`);
  }

  await createNotification({
    userId: typeof targetProfile.user_id === "string" ? targetProfile.user_id : null,
    actorUserId: access.profile?.user_id,
    type: "study_room_invitation",
    title: "Study Room invitation",
    body: access.room ? `You were invited to ${access.room.name}.` : "You were invited to a Study Room.",
    href: `/study-rooms/${roomId}`,
  });

  revalidatePath(`/study-rooms/${roomId}`);
  redirect(`/study-rooms/${roomId}?message=Invitation sent.`);
}

export async function updateStudyRoomMemberRole(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const membershipId = getFormString(formData, "membership_id");
  const nextRole = pickAllowedValue(getFormString(formData, "role"), STUDY_ROOM_ROLES, "member");

  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(membershipId)) {
    redirect("/study-rooms?message=Membership not found.");
  }

  const access = await requireStudyRoomOwner(roomId);

  if (nextRole === "owner") {
    redirect(`/study-rooms/${roomId}?message=Use ownership transfer for owner changes.`);
  }

  const admin = createAdminClient();
  const { data: membership, error: lookupError } = await admin
    .from("study_room_members")
    .select("id,profile_id,role,profiles:profile_id(user_id)")
    .eq("id", membershipId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!membership) {
    redirect(`/study-rooms/${roomId}?message=Membership not found.`);
  }

  if (membership.role === "owner") {
    redirect(`/study-rooms/${roomId}?message=Transfer ownership before changing this member.`);
  }

  const { error } = await admin
    .from("study_room_members")
    .update({ role: nextRole })
    .eq("id", membershipId)
    .eq("room_id", roomId);

  if (error) {
    redirect(`/study-rooms/${roomId}?message=${encodeMessage(error.message)}`);
  }

  await logStudyRoomModeration({
    roomId,
    actorProfileId: access.profile?.id || null,
    action: "member_role_changed",
    targetType: "member",
    targetId: membershipId,
    note: `role:${nextRole}`,
  });

  const targetProfile = membership.profiles as { user_id?: string } | null | undefined;
  await createNotification({
    userId: targetProfile?.user_id,
    actorUserId: access.profile?.user_id,
    type: "study_room_role_changed",
    title: "Study Room role updated",
    body: access.room ? `Your role in ${access.room.name} is now ${nextRole}.` : `Your Study Room role is now ${nextRole}.`,
    href: `/study-rooms/${roomId}`,
  });

  revalidatePath(`/study-rooms/${roomId}`);
  redirect(`/study-rooms/${roomId}?message=Member role updated.`);
}

export async function removeStudyRoomMember(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const membershipId = getFormString(formData, "membership_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(membershipId)) {
    redirect("/study-rooms?message=Membership not found.");
  }

  if (confirmation !== "REMOVE") {
    redirect(`/study-rooms/${roomId}?message=Type REMOVE to remove this member.`);
  }

  const access = await requireStudyRoomOwner(roomId);
  const admin = createAdminClient();
  const { data: membership, error: lookupError } = await admin
    .from("study_room_members")
    .select("role")
    .eq("id", membershipId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!membership) {
    redirect(`/study-rooms/${roomId}?message=Membership not found.`);
  }

  if (membership.role === "owner") {
    redirect(`/study-rooms/${roomId}?message=Transfer ownership before removing an owner.`);
  }

  const { error } = await admin
    .from("study_room_members")
    .delete()
    .eq("id", membershipId)
    .eq("room_id", roomId);

  if (error) {
    redirect(`/study-rooms/${roomId}?message=${encodeMessage(error.message)}`);
  }

  await logStudyRoomModeration({
    roomId,
    actorProfileId: access.profile?.id || null,
    action: "member_removed",
    targetType: "member",
    targetId: membershipId,
    note: `role:${membership.role}`,
  });

  revalidatePath(`/study-rooms/${roomId}`);
  redirect(`/study-rooms/${roomId}?message=Member removed.`);
}

export async function transferStudyRoomOwnership(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const targetProfileId = getFormString(formData, "target_profile_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(targetProfileId)) {
    redirect("/study-rooms?message=Ownership target not found.");
  }

  if (confirmation !== "TRANSFER") {
    redirect(`/study-rooms/${roomId}?message=Type TRANSFER to confirm ownership transfer.`);
  }

  const access = await requireStudyRoomOwner(roomId);
  const admin = createAdminClient();
  const { data: targetMembership, error: targetError } = await admin
    .from("study_room_members")
    .select("id,profile_id")
    .eq("room_id", roomId)
    .eq("profile_id", targetProfileId)
    .maybeSingle();

  if (targetError) {
    throw new Error(targetError.message);
  }

  if (!targetMembership) {
    redirect(`/study-rooms/${roomId}?message=New owner must already be a member.`);
  }

  const { error: memberError } = await admin.rpc("transfer_study_room_ownership", {
    target_room_id: roomId,
    new_owner_profile_id: targetProfileId,
  });

  if (memberError) {
    redirect(`/study-rooms/${roomId}?message=${encodeMessage(memberError.message)}`);
  }

  await logStudyRoomModeration({
    roomId,
    actorProfileId: access.profile?.id || null,
    action: "ownership_transferred",
    targetType: "member",
    targetId: targetMembership.id,
  });

  revalidatePath(`/study-rooms/${roomId}`);
  redirect(`/study-rooms/${roomId}?message=Ownership transferred.`);
}

export async function createStudyRoomStudy(formData: FormData) {
  const roomId = getFormString(formData, "room_id");

  if (!isStudyRoomUuid(roomId)) {
    redirect("/study-rooms?message=Study Room not found.");
  }

  const access = await requireStudyRoomLeader(roomId);
  const title = getFormString(formData, "title");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}`);

  if (!title) {
    redirect(withMessage(returnTo, "Study title is required."));
  }

  if (title.length > STUDY_ROOM_LIMITS.studyTitle) {
    redirect(withMessage(returnTo, "Study title must be 160 characters or fewer."));
  }

  const studyNumberRaw = getFormString(formData, "study_number");
  const studyNumber = studyNumberRaw ? Number(studyNumberRaw) : null;

  if (studyNumber !== null && (!Number.isInteger(studyNumber) || studyNumber <= 0)) {
    redirect(withMessage(returnTo, "Study number must be a positive whole number."));
  }

  const scheduledAtRaw = getFormString(formData, "scheduled_at");
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;

  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    redirect(withMessage(returnTo, "Choose a valid scheduled date."));
  }

  const admin = createAdminClient();
  const { data: study, error } = await admin
    .from("study_room_studies")
    .insert({
      room_id: roomId,
      title,
      description: getOptionalFormString(formData, "description", STUDY_ROOM_LIMITS.studyDescription),
      scripture_reference: getOptionalFormString(formData, "scripture_reference", STUDY_ROOM_LIMITS.scriptureReference),
      study_number: studyNumber,
      scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
      status: pickAllowedValue(getFormString(formData, "status"), STUDY_STATUSES, "draft"),
      leader_notes: getOptionalFormString(formData, "leader_notes", STUDY_ROOM_LIMITS.leaderNotes),
      closing_reflection: getOptionalFormString(formData, "closing_reflection", STUDY_ROOM_LIMITS.closingReflection),
      created_by_profile_id: access.profile?.id || null,
    })
    .select("id,title,status")
    .single();

  if (error) {
    redirect(withMessage(returnTo, error.message));
  }

  if (study.status !== "draft") {
    await notifyRoomLeaders(roomId, access.profile?.user_id || "", {
      type: "study_room_study_created",
      title: "New Study added",
      body: access.room ? `${study.title} was added to ${access.room.name}.` : `${study.title} was added.`,
      href: `/study-rooms/${roomId}`,
    });
  }

  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Study added."));
}

export async function updateStudyRoomStudy(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const studyId = getFormString(formData, "study_id");

  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(studyId)) {
    redirect("/study-rooms?message=Study not found.");
  }

  await requireStudyRoomLeader(roomId);
  const title = getFormString(formData, "title");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/study-rooms/${roomId}`);

  if (!title) {
    redirect(withMessage(returnTo, "Study title is required."));
  }

  const status = pickAllowedValue(getFormString(formData, "status"), STUDY_STATUSES, "draft");
  const admin = createAdminClient();
  const { error } = await admin
    .from("study_room_studies")
    .update({
      title: title.slice(0, STUDY_ROOM_LIMITS.studyTitle),
      description: getOptionalFormString(formData, "description", STUDY_ROOM_LIMITS.studyDescription),
      scripture_reference: getOptionalFormString(formData, "scripture_reference", STUDY_ROOM_LIMITS.scriptureReference),
      status,
      leader_notes: getOptionalFormString(formData, "leader_notes", STUDY_ROOM_LIMITS.leaderNotes),
      closing_reflection: getOptionalFormString(formData, "closing_reflection", STUDY_ROOM_LIMITS.closingReflection),
    })
    .eq("id", studyId)
    .eq("room_id", roomId);

  if (error) {
    redirect(withMessage(returnTo, error.message));
  }

  revalidatePath(`/study-rooms/${roomId}`);
  redirect(withMessage(returnTo, "Study updated."));
}

export async function updateStudyProgress(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const studyId = getFormString(formData, "study_id");

  if (!isStudyRoomUuid(roomId) || !isStudyRoomUuid(studyId)) {
    redirect("/study-rooms?message=Study not found.");
  }

  const access = await requireStudyRoomMembership(roomId);

  if (!access.profile) {
    redirect("/signin");
  }

  const status = pickAllowedValue(
    getFormString(formData, "status"),
    STUDY_PROGRESS_STATUSES,
    "not_started",
  );
  const admin = createAdminClient();
  const { data: study, error: studyError } = await admin
    .from("study_room_studies")
    .select("id")
    .eq("id", studyId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (studyError) {
    throw new Error(studyError.message);
  }

  if (!study) {
    redirect(`/study-rooms/${roomId}?message=Study not found.`);
  }

  const { error } = await admin.from("study_room_study_progress").upsert(
    {
      study_id: studyId,
      profile_id: access.profile.id,
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    },
    { onConflict: "study_id,profile_id" },
  );

  if (error) {
    redirect(`/study-rooms/${roomId}?message=${encodeMessage(error.message)}`);
  }

  await logStudyRoomModeration({
    roomId,
    actorProfileId: access.profile?.id || null,
    action: "room_archived",
    targetType: "room",
    targetId: roomId,
  });

  revalidatePath(`/study-rooms/${roomId}`);
  redirect(`/study-rooms/${roomId}?message=Study progress updated.`);
}

export async function archiveStudyRoom(formData: FormData) {
  const roomId = getFormString(formData, "room_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!isStudyRoomUuid(roomId)) {
    redirect("/study-rooms?message=Study Room not found.");
  }

  if (confirmation !== "ARCHIVE") {
    redirect(`/study-rooms/${roomId}?message=Type ARCHIVE to confirm.`);
  }

  const access = await requireStudyRoomOwner(roomId);
  const admin = createAdminClient();
  const { error } = await admin
    .from("study_rooms")
    .update({ status: "archived" })
    .eq("id", roomId);

  if (error) {
    redirect(`/study-rooms/${roomId}?message=${encodeMessage(error.message)}`);
  }

  if (access.room) {
    await notifyRoomLeaders(roomId, access.profile?.user_id || "", {
      type: "study_room_archived",
      title: "Study Room archived",
      body: `${access.room.name} was archived.`,
      href: `/study-rooms/${roomId}`,
    });
  }

  revalidatePath("/study-rooms");
  revalidatePath(`/study-rooms/${roomId}`);
  redirect("/study-rooms?message=Study Room archived.");
}
