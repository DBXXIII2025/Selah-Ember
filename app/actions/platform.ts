"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getConversation,
  getConversations,
  markConversationRead,
} from "@/app/actions/messages";
import {
  createOrGetDirectConversationForCurrentUser,
  insertDirectMessageForCurrentUser,
} from "@/lib/messages/service";
import { assertNotBanned, getActiveBanForUser } from "@/lib/moderation/bans";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformEngineer } from "@/lib/platform/auth";
import { isSafeHttpUrl } from "@/lib/media/validation";
import { getDisplayProfiles } from "@/lib/profiles/display";
import { getErrorMetadata } from "@/lib/observability/log";
import { logRequestEvent } from "@/lib/observability/request";
import {
  STUDY_ROOM_REPORT_TARGETS,
  type StudyRoomReportTarget,
  isStudyRoomUuid,
  pickAllowedValue,
} from "@/lib/study-rooms/validation";

type PlatformProfileSummary = {
  id: string;
  user_id: string;
  display_name: string;
  username: string | null;
  church_name: string | null;
  role: string;
  created_at: string;
  email: string | null;
};

export type PlatformDashboardData = {
  settings: {
    site_name: string;
    site_tagline: string | null;
    logo_url: string | null;
    homepage_announcement: string | null;
    support_contact: string | null;
  };
  plans: Array<{
    id: string;
    name: string;
    price_label: string;
    description: string | null;
    features: string[];
    is_active: boolean;
    intended_audience: string;
  }>;
  promos: Array<{
    id: string;
    code: string;
    description: string | null;
    discount_label: string;
    is_active: boolean;
    starts_at: string | null;
    ends_at: string | null;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    href: string | null;
    created_at: string;
  }>;
  users: PlatformProfileSummary[];
  communities: Array<{ id: string; name: string; slug: string | null; created_at: string }>;
  groups: Array<{ id: string; title: string; created_at: string }>;
  events: Array<{ id: string; title: string; event_time: string; created_at: string }>;
  prayer_requests: Array<{ id: string; title: string; created_at: string; is_private: boolean }>;
  bans: Array<{
    id: string;
    banned_user_id: string;
    reason: string;
    starts_at: string;
    expires_at: string;
    created_at: string;
  }>;
  message_reports: Array<{
    id: string;
    reporter_id: string;
    conversation_id: string;
    message_id: string | null;
    reason: string;
    details: string | null;
    created_at: string;
  }>;
  discussion_reports: Array<{
    id: string;
    reporter_id: string;
    thread_id: string | null;
    reply_id: string | null;
    reason: string;
    details: string | null;
    created_at: string;
  }>;
  study_room_reports: StudyRoomPlatformReport[];
  media_items: Array<{
    id: string;
    community_id: string;
    community_name: string | null;
    community_slug: string | null;
    title: string;
    media_type: string;
    content_kind: string;
    is_published: boolean;
    deleted_at: string | null;
    created_at: string;
  }>;
  community_posts: Array<{
    id: string;
    title: string | null;
    body: string | null;
    author_id: string | null;
    author_name: string | null;
    created_at: string;
    deleted_at: string | null;
  }>;
  community_post_comments: Array<{
    id: string;
    post_id: string;
    body: string;
    author_id: string | null;
    author_name: string | null;
    created_at: string;
    deleted_at: string | null;
  }>;
};

export type StudyRoomPlatformReport = {
  id: string;
  room_id: string;
  room_name: string;
  room_visibility: string;
  status: "open" | "reviewed" | "resolved" | "dismissed";
  reason: string;
  details: string | null;
  target_type: StudyRoomReportTarget;
  target_id: string | null;
  target_preview: string;
  target_author_name: string;
  reporter_label: string;
  reviewed_by_profile_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  href: string;
};

export type PlatformMessageUser = PlatformProfileSummary & {
  active_ban: {
    id: string;
    reason: string;
    expires_at: string;
  } | null;
};

export type PlatformMessagesData = {
  conversations: Awaited<ReturnType<typeof getConversations>>;
  users: PlatformMessageUser[];
};

export type PlatformConversationData = {
  conversation: Awaited<ReturnType<typeof getConversation>>;
  targetUser: PlatformMessageUser | null;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  return value.length > 0 ? value : null;
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function splitFeatures(value: string) {
  return value
    .split(/\r?\n/)
    .map((feature) => feature.trim())
    .filter(Boolean);
}

async function logPlatformMutation(
  operation: string,
  outcome: "succeeded" | "failed",
  error?: unknown,
) {
  await logRequestEvent(outcome === "failed" ? "error" : "info", `platform.${operation}.${outcome}`, {
    operation,
    outcome,
    ...(error ? getErrorMetadata(error) : {}),
  });
}

async function getUserEmailMap() {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    throw new Error(error.message);
  }

  return new Map(data.users.map((user) => [user.id, user.email || null]));
}

type StudyRoomReportFilters = {
  status?: string;
  target?: string;
  room?: string;
};

function getStudyRoomReportTarget(row: Record<string, unknown>): { targetType: StudyRoomReportTarget; targetId: string | null } {
  if (typeof row.note_id === "string") return { targetType: "note", targetId: row.note_id };
  if (typeof row.thread_id === "string") return { targetType: "thread", targetId: row.thread_id };
  if (typeof row.reply_id === "string") return { targetType: "reply", targetId: row.reply_id };
  if (typeof row.prayer_request_id === "string") return { targetType: "prayer", targetId: row.prayer_request_id };
  if (typeof row.resource_id === "string") return { targetType: "resource", targetId: row.resource_id };
  return { targetType: "note", targetId: null };
}

async function getStudyRoomReportTargetMap(reports: Record<string, unknown>[]) {
  const admin = createAdminClient();
  const map = new Map<string, { preview: string; authorUserId: string | null; roomId: string | null; hrefAnchor: string }>();
  const idsByType: Record<StudyRoomReportTarget, string[]> = {
    note: [],
    thread: [],
    reply: [],
    prayer: [],
    resource: [],
  };

  for (const report of reports) {
    const { targetType, targetId } = getStudyRoomReportTarget(report);
    if (targetId && isStudyRoomUuid(targetId)) {
      idsByType[targetType].push(targetId);
    }
  }

  const [notes, threads, replies, prayers, resources] = await Promise.all([
    idsByType.note.length
      ? admin.from("study_room_notes").select("id,room_id,title,body,author_user_id,deleted_at").in("id", idsByType.note)
      : Promise.resolve({ data: [], error: null }),
    idsByType.thread.length
      ? admin.from("study_room_discussion_threads").select("id,room_id,title,body,author_user_id,deleted_at").in("id", idsByType.thread)
      : Promise.resolve({ data: [], error: null }),
    idsByType.reply.length
      ? admin
          .from("study_room_discussion_replies")
          .select("id,thread_id,body,author_user_id,deleted_at,study_room_discussion_threads:thread_id(room_id)")
          .in("id", idsByType.reply)
      : Promise.resolve({ data: [], error: null }),
    idsByType.prayer.length
      ? admin.from("study_room_prayer_requests").select("id,room_id,title,body,author_user_id,deleted_at").in("id", idsByType.prayer)
      : Promise.resolve({ data: [], error: null }),
    idsByType.resource.length
      ? admin.from("study_room_resources").select("id,room_id,title,description,created_by_profile_id,deleted_at").in("id", idsByType.resource)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [notes, threads, replies, prayers, resources]) {
    if (result.error) throw new Error(result.error.message);
  }

  for (const row of (notes.data || []) as unknown as Record<string, unknown>[]) {
    map.set(`note:${row.id}`, {
      preview: `${row.deleted_at ? "[removed] " : ""}${String(row.title || "Untitled note")}`.slice(0, 160),
      authorUserId: typeof row.author_user_id === "string" ? row.author_user_id : null,
      roomId: typeof row.room_id === "string" ? row.room_id : null,
      hrefAnchor: `note-${row.id}`,
    });
  }
  for (const row of (threads.data || []) as unknown as Record<string, unknown>[]) {
    map.set(`thread:${row.id}`, {
      preview: `${row.deleted_at ? "[removed] " : ""}${String(row.title || "Untitled discussion")}`.slice(0, 160),
      authorUserId: typeof row.author_user_id === "string" ? row.author_user_id : null,
      roomId: typeof row.room_id === "string" ? row.room_id : null,
      hrefAnchor: `thread-${row.id}`,
    });
  }
  for (const row of (replies.data || []) as unknown as Record<string, unknown>[]) {
    const thread = row.study_room_discussion_threads as Record<string, unknown> | null | undefined;
    map.set(`reply:${row.id}`, {
      preview: `${row.deleted_at ? "[removed] " : ""}${String(row.body || "Reply").slice(0, 120)}`,
      authorUserId: typeof row.author_user_id === "string" ? row.author_user_id : null,
      roomId: typeof thread?.room_id === "string" ? thread.room_id : null,
      hrefAnchor: `reply-${row.id}`,
    });
  }
  for (const row of (prayers.data || []) as unknown as Record<string, unknown>[]) {
    map.set(`prayer:${row.id}`, {
      preview: `${row.deleted_at ? "[removed] " : ""}${String(row.title || "Prayer request")}`.slice(0, 160),
      authorUserId: typeof row.author_user_id === "string" ? row.author_user_id : null,
      roomId: typeof row.room_id === "string" ? row.room_id : null,
      hrefAnchor: `prayer-${row.id}`,
    });
  }
  for (const row of (resources.data || []) as unknown as Record<string, unknown>[]) {
    map.set(`resource:${row.id}`, {
      preview: `${row.deleted_at ? "[removed] " : ""}${String(row.title || "Resource")}`.slice(0, 160),
      authorUserId: null,
      roomId: typeof row.room_id === "string" ? row.room_id : null,
      hrefAnchor: `resource-${row.id}`,
    });
  }

  return map;
}

async function getStudyRoomPlatformReports(filters: StudyRoomReportFilters = {}): Promise<StudyRoomPlatformReport[]> {
  const admin = createAdminClient();
  const status = filters.status && ["open", "reviewed", "resolved", "dismissed", "all"].includes(filters.status) ? filters.status : "open";
  const target = filters.target && STUDY_ROOM_REPORT_TARGETS.includes(filters.target as StudyRoomReportTarget) ? filters.target : "all";
  const roomTerm = (filters.room || "").trim();

  let query = admin
    .from("study_room_reports")
    .select("id,reporter_user_id,room_id,note_id,thread_id,reply_id,prayer_request_id,resource_id,reason,details,status,reviewed_by_profile_id,reviewed_at,created_at,study_rooms:room_id(name,visibility)")
    .order("created_at", { ascending: false })
    .limit(25);

  if (status !== "all") query = query.eq("status", status);
  if (target !== "all") {
    const columnByTarget: Record<StudyRoomReportTarget, string> = {
      note: "note_id",
      thread: "thread_id",
      reply: "reply_id",
      prayer: "prayer_request_id",
      resource: "resource_id",
    };
    query = query.not(columnByTarget[target as StudyRoomReportTarget], "is", null);
  }
  if (roomTerm && isStudyRoomUuid(roomTerm)) {
    query = query.eq("room_id", roomTerm);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = ((data || []) as unknown as Record<string, unknown>[]).filter((row) => {
    if (!roomTerm || isStudyRoomUuid(roomTerm)) return true;
    const room = row.study_rooms as Record<string, unknown> | null | undefined;
    return String(room?.name || "").toLowerCase().includes(roomTerm.toLowerCase());
  });
  const targetMap = await getStudyRoomReportTargetMap(rows);
  const reporterIds = rows.map((row) => row.reporter_user_id).filter((id): id is string => typeof id === "string");
  const targetAuthorIds = Array.from(targetMap.values()).map((target) => target.authorUserId).filter((id): id is string => typeof id === "string");
  const displayProfiles = await getDisplayProfiles([...reporterIds, ...targetAuthorIds]);

  return rows.map((row) => {
    const room = row.study_rooms as Record<string, unknown> | null | undefined;
    const { targetType, targetId } = getStudyRoomReportTarget(row);
    const targetData = targetId ? targetMap.get(`${targetType}:${targetId}`) : null;
    const roomId = String(row.room_id);
    return {
      id: String(row.id),
      room_id: roomId,
      room_name: typeof room?.name === "string" ? room.name : "Study Room unavailable",
      room_visibility: typeof room?.visibility === "string" ? room.visibility : "unknown",
      status: row.status === "reviewed" || row.status === "resolved" || row.status === "dismissed" ? row.status : "open",
      reason: String(row.reason),
      details: typeof row.details === "string" ? row.details : null,
      target_type: targetType,
      target_id: targetId,
      target_preview: targetData?.preview || "Reported target unavailable",
      target_author_name: targetData?.authorUserId ? displayProfiles.get(targetData.authorUserId)?.display_name || "Deleted user" : "Deleted user",
      reporter_label: typeof row.reporter_user_id === "string" ? displayProfiles.get(row.reporter_user_id)?.display_name || "Deleted user" : "Deleted user",
      reviewed_by_profile_id: typeof row.reviewed_by_profile_id === "string" ? row.reviewed_by_profile_id : null,
      reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
      created_at: String(row.created_at),
      href: `/study-rooms/${roomId}?section=${targetType === "note" ? "notes" : targetType === "prayer" ? "prayer" : targetType === "resource" ? "resources" : "discussion"}${targetData?.hrefAnchor ? `#${targetData.hrefAnchor}` : ""}`,
    };
  });
}

type StudyRoomReportRecord = {
  id: string;
  reporter_user_id: string;
  room_id: string;
  note_id: string | null;
  thread_id: string | null;
  reply_id: string | null;
  prayer_request_id: string | null;
  resource_id: string | null;
  reason: string;
  details: string | null;
  status: "open" | "reviewed" | "resolved" | "dismissed";
};

type StudyRoomTargetResolution = {
  targetType: StudyRoomReportTarget;
  targetId: string;
  roomId: string;
  threadId: string | null;
};

async function insertStudyRoomModerationAudit(input: {
  roomId: string | null;
  reportId: string | null;
  actorProfileId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  note?: string | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("study_room_moderation_audit").insert({
    room_id: input.roomId,
    report_id: input.reportId,
    actor_profile_id: input.actorProfileId,
    action: input.action.slice(0, 120),
    target_type: input.targetType,
    target_id: input.targetId,
    note: input.note ? input.note.slice(0, 500) : null,
  });

  if (error?.code === "42P01" || error?.code === "PGRST205") {
    await logRequestEvent("warn", "platform.study_room_audit.unavailable", {
      operation: "study_room_audit",
      resourceType: "study_room_report",
      outcome: "failed",
    });
    return;
  }

  if (error) {
    throw new Error(error.message);
  }
}

async function logStudyRoomPlatformAction(input: {
  actorProfileId: string | null;
  action: string;
  roomId: string | null;
  reportId: string | null;
  targetType: string;
  targetId: string | null;
  note?: string | null;
}) {
  await logRequestEvent("info", `platform.study_room.${input.action}`, {
    operation: "study_room_platform_moderation",
    resourceType: "study_room_report",
    outcome: "succeeded",
  });
  await insertStudyRoomModerationAudit(input);
}

async function getStudyRoomReportForPlatform(reportId: string): Promise<StudyRoomReportRecord | null> {
  if (!isStudyRoomUuid(reportId)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("study_room_reports")
    .select("id,reporter_user_id,room_id,note_id,thread_id,reply_id,prayer_request_id,resource_id,reason,details,status")
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;
  return data as StudyRoomReportRecord;
}

async function resolveStudyRoomReportTarget(report: StudyRoomReportRecord): Promise<StudyRoomTargetResolution | null> {
  const { targetType, targetId } = getStudyRoomReportTarget(report);
  if (!targetId || !isStudyRoomUuid(targetId)) return null;

  const admin = createAdminClient();
  if (targetType === "reply") {
    const { data, error } = await admin
      .from("study_room_discussion_replies")
      .select("id,thread_id,study_room_discussion_threads:thread_id(room_id)")
      .eq("id", targetId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    const thread = data.study_room_discussion_threads as unknown as Record<string, unknown> | null | undefined;
    const roomId = typeof thread?.room_id === "string" ? thread.room_id : null;
    if (!roomId || roomId !== report.room_id || typeof data.thread_id !== "string") return null;
    return { targetType, targetId, roomId, threadId: data.thread_id };
  }

  const tableByTarget: Record<Exclude<StudyRoomReportTarget, "reply">, "study_room_notes" | "study_room_discussion_threads" | "study_room_prayer_requests" | "study_room_resources"> = {
    note: "study_room_notes",
    thread: "study_room_discussion_threads",
    prayer: "study_room_prayer_requests",
    resource: "study_room_resources",
  };
  const { data, error } = await admin
    .from(tableByTarget[targetType])
    .select("id,room_id")
    .eq("id", targetId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const roomId = typeof data?.room_id === "string" ? data.room_id : null;
  if (!roomId || roomId !== report.room_id) return null;
  return { targetType, targetId, roomId, threadId: targetType === "thread" ? targetId : null };
}

function getStudyRoomReportReturnPath(status?: string, target?: string, room?: string) {
  const params = new URLSearchParams();
  if (status) params.set("sr_status", status);
  if (target) params.set("sr_target", target);
  if (room) params.set("sr_room", room);
  const suffix = params.toString();
  return `/platform${suffix ? `?${suffix}` : ""}`;
}

function withPlatformMessage(path: string, message: string) {
  return `${path}${path.includes("?") ? "&" : "?"}message=${encodeURIComponent(message)}`;
}

export async function reviewStudyRoomReport(formData: FormData) {
  const actor = await requirePlatformEngineer();
  const reportId = getFormString(formData, "report_id");
  const nextStatus = pickAllowedValue(getFormString(formData, "status"), ["reviewed", "resolved", "dismissed"] as const, "reviewed");
  const returnTo = getStudyRoomReportReturnPath(
    getFormString(formData, "sr_status"),
    getFormString(formData, "sr_target"),
    getFormString(formData, "sr_room"),
  );
  const report = await getStudyRoomReportForPlatform(reportId);
  if (!report) redirect(withPlatformMessage(returnTo, "Study Room report not found."));
  if ((report.status === "resolved" || report.status === "dismissed") && report.status === nextStatus) {
    redirect(withPlatformMessage(returnTo, `Study Room report is already ${nextStatus}.`));
  }

  const resolution = await resolveStudyRoomReportTarget(report);
  if (!resolution) redirect(withPlatformMessage(returnTo, "Reported Study Room target is unavailable."));

  const admin = createAdminClient();
  const { error } = await admin
    .from("study_room_reports")
    .update({
      status: nextStatus,
      reviewed_by_profile_id: actor.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .eq("room_id", resolution.roomId);

  if (error) redirect(withPlatformMessage(returnTo, error.message));

  await logStudyRoomPlatformAction({
    actorProfileId: actor.id,
    action: `platform_report_${nextStatus}`,
    roomId: resolution.roomId,
    reportId: report.id,
    targetType: "report",
    targetId: report.id,
    note: `target:${resolution.targetType}`,
  });
  revalidatePath("/platform");
  redirect(withPlatformMessage(returnTo, `Study Room report ${nextStatus}.`));
}

export async function removeReportedStudyRoomContent(formData: FormData) {
  const actor = await requirePlatformEngineer();
  const reportId = getFormString(formData, "report_id");
  const confirmation = getFormString(formData, "confirmation");
  const returnTo = getStudyRoomReportReturnPath(
    getFormString(formData, "sr_status"),
    getFormString(formData, "sr_target"),
    getFormString(formData, "sr_room"),
  );
  if (confirmation !== "REMOVE") redirect(withPlatformMessage(returnTo, "Type REMOVE to remove reported content."));
  const report = await getStudyRoomReportForPlatform(reportId);
  if (!report) redirect(withPlatformMessage(returnTo, "Study Room report not found."));
  const resolution = await resolveStudyRoomReportTarget(report);
  if (!resolution) redirect(withPlatformMessage(returnTo, "Reported Study Room target is unavailable."));

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const mutation =
    resolution.targetType === "note"
      ? admin.from("study_room_notes").update({ deleted_at: now }).eq("id", resolution.targetId).eq("room_id", resolution.roomId)
      : resolution.targetType === "thread"
        ? admin.from("study_room_discussion_threads").update({ deleted_at: now }).eq("id", resolution.targetId).eq("room_id", resolution.roomId)
        : resolution.targetType === "reply"
          ? admin.from("study_room_discussion_replies").update({ deleted_at: now }).eq("id", resolution.targetId).eq("thread_id", resolution.threadId)
          : resolution.targetType === "prayer"
            ? admin.from("study_room_prayer_requests").update({ status: "removed", deleted_at: now }).eq("id", resolution.targetId).eq("room_id", resolution.roomId)
            : admin.from("study_room_resources").update({ deleted_at: now }).eq("id", resolution.targetId).eq("room_id", resolution.roomId);

  const { error } = await mutation;
  if (error) redirect(withPlatformMessage(returnTo, error.message));

  const { error: reportError } = await admin
    .from("study_room_reports")
    .update({ status: "resolved", reviewed_by_profile_id: actor.id, reviewed_at: now })
    .eq("id", report.id)
    .eq("room_id", resolution.roomId);
  if (reportError) redirect(withPlatformMessage(returnTo, reportError.message));

  await logStudyRoomPlatformAction({
    actorProfileId: actor.id,
    action: "platform_report_content_removed",
    roomId: resolution.roomId,
    reportId: report.id,
    targetType: resolution.targetType,
    targetId: resolution.targetId,
    note: "soft-delete",
  });
  revalidatePath("/platform");
  revalidatePath(`/study-rooms/${resolution.roomId}`);
  redirect(withPlatformMessage(returnTo, "Reported Study Room content removed."));
}

export async function lockReportedStudyRoomThread(formData: FormData) {
  const actor = await requirePlatformEngineer();
  const reportId = getFormString(formData, "report_id");
  const confirmation = getFormString(formData, "confirmation");
  const returnTo = getStudyRoomReportReturnPath(
    getFormString(formData, "sr_status"),
    getFormString(formData, "sr_target"),
    getFormString(formData, "sr_room"),
  );
  if (confirmation !== "LOCK") redirect(withPlatformMessage(returnTo, "Type LOCK to lock the discussion."));
  const report = await getStudyRoomReportForPlatform(reportId);
  if (!report) redirect(withPlatformMessage(returnTo, "Study Room report not found."));
  const resolution = await resolveStudyRoomReportTarget(report);
  if (!resolution || !resolution.threadId) redirect(withPlatformMessage(returnTo, "Reported discussion is unavailable."));

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("study_room_discussion_threads")
    .update({ is_locked: true })
    .eq("id", resolution.threadId)
    .eq("room_id", resolution.roomId);
  if (error) redirect(withPlatformMessage(returnTo, error.message));

  await admin
    .from("study_room_reports")
    .update({ status: report.status === "open" ? "reviewed" : report.status, reviewed_by_profile_id: actor.id, reviewed_at: now })
    .eq("id", report.id)
    .eq("room_id", resolution.roomId);

  await logStudyRoomPlatformAction({
    actorProfileId: actor.id,
    action: "platform_report_thread_locked",
    roomId: resolution.roomId,
    reportId: report.id,
    targetType: "thread",
    targetId: resolution.threadId,
    note: `source:${resolution.targetType}`,
  });
  revalidatePath("/platform");
  revalidatePath(`/study-rooms/${resolution.roomId}`);
  redirect(withPlatformMessage(returnTo, "Study Room discussion locked."));
}

export async function archiveReportedStudyRoom(formData: FormData) {
  const actor = await requirePlatformEngineer();
  const reportId = getFormString(formData, "report_id");
  const confirmation = getFormString(formData, "confirmation");
  const returnTo = getStudyRoomReportReturnPath(
    getFormString(formData, "sr_status"),
    getFormString(formData, "sr_target"),
    getFormString(formData, "sr_room"),
  );
  if (confirmation !== "ARCHIVE") redirect(withPlatformMessage(returnTo, "Type ARCHIVE to archive the Study Room."));
  const report = await getStudyRoomReportForPlatform(reportId);
  if (!report) redirect(withPlatformMessage(returnTo, "Study Room report not found."));
  const resolution = await resolveStudyRoomReportTarget(report);
  if (!resolution) redirect(withPlatformMessage(returnTo, "Reported Study Room target is unavailable."));

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("study_rooms").update({ status: "archived" }).eq("id", resolution.roomId);
  if (error) redirect(withPlatformMessage(returnTo, error.message));
  const { error: reportError } = await admin
    .from("study_room_reports")
    .update({ status: "resolved", reviewed_by_profile_id: actor.id, reviewed_at: now })
    .eq("id", report.id)
    .eq("room_id", resolution.roomId);
  if (reportError) redirect(withPlatformMessage(returnTo, reportError.message));

  await logStudyRoomPlatformAction({
    actorProfileId: actor.id,
    action: "platform_report_room_archived",
    roomId: resolution.roomId,
    reportId: report.id,
    targetType: "room",
    targetId: resolution.roomId,
    note: `source:${resolution.targetType}`,
  });
  revalidatePath("/platform");
  revalidatePath("/study-rooms");
  revalidatePath(`/study-rooms/${resolution.roomId}`);
  redirect(withPlatformMessage(returnTo, "Study Room archived."));
}

async function getPlatformMessageUsers(search = "") {
  const admin = createAdminClient();
  const term = search.trim();
  const emailMap = await getUserEmailMap();
  const matchingEmailUserIds = term
    ? Array.from(emailMap.entries())
        .filter(([, email]) => email?.toLowerCase().includes(term.toLowerCase()))
        .map(([userId]) => userId)
    : [];

  let query = admin
    .from("profiles")
    .select("id,user_id,display_name,username,church_name,role,created_at")
    .not("user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (term) {
    const escapedTerm = term.replace(/[,%()]/g, " ");
    const filters = [
      `display_name.ilike.%${escapedTerm}%`,
      `username.ilike.%${escapedTerm}%`,
      `church_name.ilike.%${escapedTerm}%`,
    ];

    if (matchingEmailUserIds.length > 0) {
      filters.push(`user_id.in.(${matchingEmailUserIds.join(",")})`);
    }

    query = query.or(filters.join(","));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const users = await Promise.all(
    ((data || []) as unknown as Record<string, unknown>[]).map(async (profile) => {
      const userId = String(profile.user_id);
      const activeBan = await getActiveBanForUser(userId);

      return {
        id: String(profile.id),
        user_id: userId,
        display_name: String(profile.display_name),
        username: typeof profile.username === "string" ? profile.username : null,
        church_name: typeof profile.church_name === "string" ? profile.church_name : null,
        role: typeof profile.role === "string" ? profile.role : "user",
        created_at: String(profile.created_at),
        email: emailMap.get(userId) || null,
        active_ban: activeBan
          ? {
              id: activeBan.id,
              reason: activeBan.reason,
              expires_at: activeBan.expires_at,
            }
          : null,
      };
    }),
  );

  return users;
}

async function getPlatformMessageUserById(userId: string) {
  const admin = createAdminClient();
  const [emailMap, activeBan] = await Promise.all([
    getUserEmailMap(),
    getActiveBanForUser(userId),
  ]);
  const { data, error } = await admin
    .from("profiles")
    .select("id,user_id,display_name,username,church_name,role,created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    id: String(data.id),
    user_id: String(data.user_id),
    display_name: String(data.display_name),
    username: typeof data.username === "string" ? data.username : null,
    church_name: typeof data.church_name === "string" ? data.church_name : null,
    role: typeof data.role === "string" ? data.role : "user",
    created_at: String(data.created_at),
    email: emailMap.get(userId) || null,
    active_ban: activeBan
      ? {
          id: activeBan.id,
          reason: activeBan.reason,
          expires_at: activeBan.expires_at,
        }
      : null,
  };
}

export async function getPlatformMessagesData(search = ""): Promise<PlatformMessagesData> {
  await requirePlatformEngineer();
  const [conversations, users] = await Promise.all([
    getConversations(),
    getPlatformMessageUsers(search),
  ]);

  return { conversations, users };
}

export async function getPlatformConversationData(conversationId: string): Promise<PlatformConversationData> {
  const profile = await requirePlatformEngineer();
  const conversation = await getConversation(conversationId);

  if (!conversation) {
    return { conversation: null, targetUser: null };
  }

  const targetParticipant = conversation.participants.find(
    (participant) => participant.user_id !== profile.user_id,
  );
  const targetUser = targetParticipant ? await getPlatformMessageUserById(targetParticipant.user_id) : null;

  await markConversationRead(conversationId);

  return {
    conversation,
    targetUser: targetUser || null,
  };
}

export async function startPlatformSupportConversation(formData: FormData) {
  const profile = await requirePlatformEngineer();
  await assertNotBanned(profile.user_id, "/platform/messages?message=Your account cannot send messages right now.");
  const targetUserId = getFormString(formData, "target_user_id");

  if (!targetUserId) {
    redirect("/platform/messages?message=Choose a user to message.");
  }

  if (targetUserId === profile.user_id) {
    redirect("/platform/messages?message=Choose someone other than yourself.");
  }

  const admin = createAdminClient();
  const { data: targetProfile, error } = await admin
    .from("profiles")
    .select("user_id")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!targetProfile) {
    redirect("/platform/messages?message=That user is not available.");
  }

  const conversationId = await createOrGetDirectConversationForCurrentUser(targetUserId);

  revalidatePath("/platform/messages");
  revalidatePath("/messages");
  redirect(`/platform/messages/${conversationId}`);
}

export async function getPlatformDashboardData(
  search = "",
  studyRoomFilters: StudyRoomReportFilters = {},
): Promise<PlatformDashboardData> {
  await requirePlatformEngineer();
  const admin = createAdminClient();
  const term = search.trim();

  const [
    settingsResult,
    plansResult,
    promosResult,
    announcementsResult,
    profilesResult,
    communitiesResult,
    groupsResult,
    eventsResult,
    prayerResult,
    bansResult,
    reportsResult,
    discussionReportsResult,
    mediaResult,
    communityPostsResult,
    communityCommentsResult,
    studyRoomReports,
    emailMap,
  ] = await Promise.all([
    admin
      .from("platform_settings")
      .select("site_name,site_tagline,logo_url,homepage_announcement,support_contact")
      .eq("id", true)
      .single(),
    admin
      .from("platform_plans")
      .select("id,name,price_label,description,features,is_active,intended_audience")
      .order("created_at", { ascending: false }),
    admin
      .from("platform_promo_codes")
      .select("id,code,description,discount_label,is_active,starts_at,ends_at")
      .order("created_at", { ascending: false }),
    admin
      .from("platform_announcements")
      .select("id,title,body,href,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    term
      ? admin
          .from("profiles")
          .select("id,user_id,display_name,username,church_name,role,created_at")
          .or(`display_name.ilike.%${term}%,username.ilike.%${term}%,church_name.ilike.%${term}%`)
          .order("created_at", { ascending: false })
          .limit(50)
      : admin
          .from("profiles")
          .select("id,user_id,display_name,username,church_name,role,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
    admin.from("churches").select("id,name,slug,created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("study_groups").select("id,title,name,created_at").order("created_at", { ascending: false }).limit(50),
    admin
      .from("events")
      .select("id,title,event_time,starts_at,created_at")
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("prayer_requests")
      .select("id,title,created_at,is_private")
      .eq("is_private", false)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("user_bans")
      .select("id,banned_user_id,reason,starts_at,expires_at,created_at")
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("message_reports")
      .select("id,reporter_id,conversation_id,message_id,reason,details,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("discussion_reports")
      .select("id,reporter_id,thread_id,reply_id,reason,details,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("media_items")
      .select("id,community_id,title,media_type,content_kind,is_published,deleted_at,created_at, churches:community_id(name,slug)")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("community_posts")
      .select("id,title,body,author_id,created_at,deleted_at")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("community_post_comments")
      .select("id,post_id,body,author_id,created_at,deleted_at")
      .order("created_at", { ascending: false })
      .limit(10),
    getStudyRoomPlatformReports(studyRoomFilters),
    getUserEmailMap(),
  ]);

  for (const result of [
    settingsResult,
    plansResult,
    promosResult,
    announcementsResult,
    profilesResult,
    communitiesResult,
    groupsResult,
    eventsResult,
    prayerResult,
    bansResult,
    reportsResult,
    discussionReportsResult,
    mediaResult,
    communityPostsResult,
    communityCommentsResult,
  ]) {
    if (result.error) {
      if (
        (result === reportsResult ||
          result === discussionReportsResult ||
          result === mediaResult ||
          result === communityPostsResult ||
          result === communityCommentsResult) &&
        result.error.code === "42P01"
      ) {
        continue;
      }

      throw new Error(result.error.message);
    }
  }

  const users = ((profilesResult.data || []) as unknown as Record<string, unknown>[]).map((profile) => ({
    id: String(profile.id),
    user_id: String(profile.user_id),
    display_name: String(profile.display_name),
    username: typeof profile.username === "string" ? profile.username : null,
    church_name: typeof profile.church_name === "string" ? profile.church_name : null,
    role: typeof profile.role === "string" ? profile.role : "user",
    created_at: String(profile.created_at),
    email: emailMap.get(String(profile.user_id)) || null,
  }));
  const communityAuthorIds = [
    ...((communityPostsResult.data || []) as unknown as Record<string, unknown>[]).map((row) => row.author_id),
    ...((communityCommentsResult.data || []) as unknown as Record<string, unknown>[]).map((row) => row.author_id),
  ].filter((authorId): authorId is string => typeof authorId === "string" && authorId.length > 0);
  const communityAuthors = await getDisplayProfiles(communityAuthorIds);

  return {
    settings: settingsResult.data || {
      site_name: "Selah Ember",
      site_tagline: "Faith, Reflection, Community",
      logo_url: null,
      homepage_announcement: null,
      support_contact: null,
    },
    plans: ((plansResult.data || []) as unknown as PlatformDashboardData["plans"]),
    promos: ((promosResult.data || []) as unknown as PlatformDashboardData["promos"]),
    announcements: ((announcementsResult.data || []) as unknown as PlatformDashboardData["announcements"]),
    users,
    communities: ((communitiesResult.data || []) as unknown as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: typeof row.slug === "string" ? row.slug : null,
      created_at: String(row.created_at),
    })),
    groups: ((groupsResult.data || []) as unknown as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      title: typeof row.title === "string" ? row.title : String(row.name || ""),
      created_at: String(row.created_at),
    })),
    events: ((eventsResult.data || []) as unknown as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      event_time: String(row.event_time || row.starts_at || row.created_at),
      created_at: String(row.created_at),
    })),
    prayer_requests: ((prayerResult.data || []) as unknown as PlatformDashboardData["prayer_requests"]),
    bans: ((bansResult.data || []) as unknown as PlatformDashboardData["bans"]),
    message_reports: ((reportsResult.data || []) as unknown as PlatformDashboardData["message_reports"]),
    discussion_reports: ((discussionReportsResult.data || []) as unknown as PlatformDashboardData["discussion_reports"]),
    study_room_reports: studyRoomReports,
    media_items: ((mediaResult.data || []) as unknown as Record<string, unknown>[]).map((row) => {
      const community = row.churches as { name?: string; slug?: string } | null | undefined;

      return {
        id: String(row.id),
        community_id: String(row.community_id),
        community_name: community?.name || null,
        community_slug: typeof community?.slug === "string" ? community.slug : null,
        title: String(row.title),
        media_type: String(row.media_type),
        content_kind: String(row.content_kind),
        is_published: row.is_published !== false,
        deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
        created_at: String(row.created_at),
      };
    }),
    community_posts: ((communityPostsResult.data || []) as unknown as Record<string, unknown>[]).map((row) => {
      const authorId = typeof row.author_id === "string" ? row.author_id : null;
      return {
        id: String(row.id),
        title: typeof row.title === "string" ? row.title : null,
        body: typeof row.body === "string" ? row.body : null,
        author_id: authorId,
        author_name: authorId ? communityAuthors.get(authorId)?.display_name || "Member" : "Member",
        created_at: String(row.created_at),
        deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
      };
    }),
    community_post_comments: ((communityCommentsResult.data || []) as unknown as Record<string, unknown>[]).map((row) => {
      const authorId = typeof row.author_id === "string" ? row.author_id : null;
      return {
        id: String(row.id),
        post_id: String(row.post_id),
        body: String(row.body),
        author_id: authorId,
        author_name: authorId ? communityAuthors.get(authorId)?.display_name || "Member" : "Member",
        created_at: String(row.created_at),
        deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
      };
    }),
  };
}

export async function updatePlatformSettings(formData: FormData) {
  const profile = await requirePlatformEngineer();
  const siteName = getFormString(formData, "site_name");
  const logoUrl = nullableFormString(formData, "logo_url");

  if (!siteName) {
    redirect("/platform?message=Site name is required.");
  }

  if (logoUrl && !isSafeHttpUrl(logoUrl)) {
    redirect("/platform?message=Logo URL must be a valid HTTP or HTTPS URL.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("platform_settings").upsert(
    {
      id: true,
      site_name: siteName,
      site_tagline: nullableFormString(formData, "site_tagline"),
      logo_url: logoUrl,
      homepage_announcement: nullableFormString(formData, "homepage_announcement"),
      support_contact: nullableFormString(formData, "support_contact"),
      updated_by: profile.id,
    },
    { onConflict: "id" },
  );

  if (error) {
    await logPlatformMutation("settings_update", "failed", error);
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  await logPlatformMutation("settings_update", "succeeded");
  revalidatePath("/platform");
  redirect("/platform?message=Site settings updated.");
}

export async function updatePlatformUserRole(formData: FormData) {
  const actor = await requirePlatformEngineer();
  const profileId = getFormString(formData, "profile_id");
  const nextRole = getFormString(formData, "role");

  if (!profileId || !["user", "platform_engineer"].includes(nextRole)) {
    redirect("/platform?message=Choose a valid user role.");
  }

  const admin = createAdminClient();
  const { data: target, error: lookupError } = await admin
    .from("profiles")
    .select("id,user_id,role")
    .eq("id", profileId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!target) {
    redirect("/platform?message=User profile not found.");
  }

  if (target.user_id === actor.user_id && nextRole !== "platform_engineer") {
    redirect("/platform?message=You cannot demote yourself.");
  }

  if (target.role === "platform_engineer" && nextRole !== "platform_engineer") {
    redirect("/platform?message=You cannot demote a platform engineer from this panel.");
  }

  const { error } = await admin.from("profiles").update({ role: nextRole }).eq("id", profileId);

  if (error) {
    await logPlatformMutation("user_role_update", "failed", error);
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  await logPlatformMutation("user_role_update", "succeeded");
  revalidatePath("/platform");
  revalidatePath("/platform/leader-applications");
  redirect("/platform?message=User role updated.");
}

export async function savePlatformPlan(formData: FormData) {
  const profile = await requirePlatformEngineer();
  const name = getFormString(formData, "name");
  const priceLabel = getFormString(formData, "price_label");
  const audience = getFormString(formData, "intended_audience") || "individual";
  const id = nullableFormString(formData, "plan_id");

  if (!name || !priceLabel) {
    redirect("/platform?message=Plan name and price label are required.");
  }

  if (!["individual", "church", "ministry"].includes(audience)) {
    redirect("/platform?message=Choose a valid plan audience.");
  }

  const admin = createAdminClient();
  const payload = {
    name,
    price_label: priceLabel,
    description: nullableFormString(formData, "description"),
    features: splitFeatures(getFormString(formData, "features")),
    is_active: getBoolean(formData, "is_active"),
    intended_audience: audience,
    created_by: profile.id,
  };
  const query = id
    ? admin.from("platform_plans").update(payload).eq("id", id)
    : admin.from("platform_plans").insert(payload);
  const { error } = await query;

  if (error) {
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/platform");
  redirect(`/platform?message=${id ? "Plan updated." : "Plan created."}`);
}

export async function deletePlatformPlan(formData: FormData) {
  await requirePlatformEngineer();
  const id = getFormString(formData, "plan_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!id || confirmation !== "DELETE") {
    redirect("/platform?message=Type DELETE to confirm plan deletion.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_plans")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/platform");
  redirect("/platform?message=Plan deactivated.");
}

export async function savePromoCode(formData: FormData) {
  const profile = await requirePlatformEngineer();
  const code = getFormString(formData, "code").toUpperCase();
  const discountLabel = getFormString(formData, "discount_label");

  if (!code || !discountLabel) {
    redirect("/platform?message=Promo code and discount label are required.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("platform_promo_codes").insert({
    code,
    description: nullableFormString(formData, "description"),
    discount_label: discountLabel,
    is_active: getBoolean(formData, "is_active"),
    starts_at: nullableFormString(formData, "starts_at"),
    ends_at: nullableFormString(formData, "ends_at"),
    created_by: profile.id,
  });

  if (error) {
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/platform");
  redirect("/platform?message=Promo code created.");
}

export async function deletePromoCode(formData: FormData) {
  await requirePlatformEngineer();
  const id = getFormString(formData, "promo_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!id || confirmation !== "DELETE") {
    redirect("/platform?message=Type DELETE to confirm promo code deletion.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_promo_codes")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/platform");
  redirect("/platform?message=Promo code deactivated.");
}

export async function sendPlatformAnnouncement(formData: FormData) {
  const profile = await requirePlatformEngineer();
  const title = getFormString(formData, "title");
  const body = getFormString(formData, "body");
  const href = nullableFormString(formData, "href");

  if (!title || !body) {
    redirect("/platform?message=Announcement title and body are required.");
  }

  if (href && !href.startsWith("/") && !isSafeHttpUrl(href)) {
    redirect("/platform?message=Announcement link must be a relative path or safe URL.");
  }

  const admin = createAdminClient();
  const { data: announcement, error } = await admin
    .from("platform_announcements")
    .insert({
      title,
      body,
      href,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  const notificationHref = href || `/notifications?announcement=${announcement.id}`;
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("user_id")
    .not("user_id", "is", null);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const userIds = (profiles || [])
    .map((row) => row.user_id)
    .filter((userId): userId is string => typeof userId === "string");
  const { data: existing, error: existingError } = await admin
    .from("notifications")
    .select("user_id")
    .eq("type", "platform_announcement")
    .eq("href", notificationHref)
    .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingUserIds = new Set((existing || []).map((row) => row.user_id));
  const notifications = userIds
    .filter((userId) => !existingUserIds.has(userId))
    .map((userId) => ({
      user_id: userId,
      actor_user_id: profile.user_id,
      type: "platform_announcement",
      title,
      body,
      href: notificationHref,
    }));

  if (notifications.length > 0) {
    const { error: notificationError } = await admin.from("notifications").insert(notifications);

    if (notificationError) {
      throw new Error(notificationError.message);
    }
  }

  await logRequestEvent("info", "platform.announcement.send.succeeded", {
    operation: "announcement_send",
    outcome: "succeeded",
    notificationCount: notifications.length,
  });
  revalidatePath("/platform");
  revalidatePath("/notifications");
  redirect("/platform?message=Announcement sent.");
}

export async function deletePlatformAnnouncement(formData: FormData) {
  await requirePlatformEngineer();
  const id = getFormString(formData, "announcement_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!id || confirmation !== "DELETE") {
    redirect("/platform?message=Type DELETE to confirm announcement deletion.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_announcements")
    .delete()
    .eq("id", id);

  if (error) {
    await logPlatformMutation("announcement_delete", "failed", error);
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  await logPlatformMutation("announcement_delete", "succeeded");
  revalidatePath("/platform");
  redirect("/platform?message=Announcement deleted.");
}

export async function deletePlatformCommunity(formData: FormData) {
  await requirePlatformEngineer();
  const id = getFormString(formData, "community_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!id || confirmation !== "DELETE") {
    redirect("/platform?message=Type DELETE to confirm community deletion.");
  }

  const admin = createAdminClient();
  const { data: community, error: lookupError } = await admin
    .from("churches")
    .select("id,slug")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!community) {
    redirect("/platform?message=Community not found.");
  }

  const { error } = await admin.from("churches").delete().eq("id", id);

  if (error) {
    await logPlatformMutation("community_delete", "failed", error);
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  await logPlatformMutation("community_delete", "succeeded");
  revalidatePath("/platform");
  revalidatePath("/communities");
  revalidatePath("/discover");
  if (typeof community.slug === "string" && community.slug) {
    revalidatePath(`/c/${community.slug}`);
  }
  redirect("/platform?message=Community deleted.");
}

export async function deletePlatformGroup(formData: FormData) {
  await requirePlatformEngineer();
  const id = getFormString(formData, "group_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!id || confirmation !== "DELETE") {
    redirect("/platform?message=Type DELETE to confirm group deletion.");
  }

  const admin = createAdminClient();
  const { data: group, error: lookupError } = await admin
    .from("study_groups")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!group) {
    redirect("/platform?message=Group not found.");
  }

  const { error } = await admin.from("study_groups").delete().eq("id", id);

  if (error) {
    await logPlatformMutation("group_delete", "failed", error);
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  await logPlatformMutation("group_delete", "succeeded");
  revalidatePath("/platform");
  revalidatePath("/groups");
  revalidatePath("/discover/groups");
  redirect("/platform?message=Group deleted.");
}

export async function deletePlatformEvent(formData: FormData) {
  await requirePlatformEngineer();
  const id = getFormString(formData, "event_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!id || confirmation !== "DELETE") {
    redirect("/platform?message=Type DELETE to confirm event deletion.");
  }

  const admin = createAdminClient();
  const { data: event, error: lookupError } = await admin
    .from("events")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!event) {
    redirect("/platform?message=Event not found.");
  }

  const { error } = await admin.from("events").delete().eq("id", id);

  if (error) {
    await logPlatformMutation("event_delete", "failed", error);
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  await logPlatformMutation("event_delete", "succeeded");
  revalidatePath("/platform");
  revalidatePath("/events");
  redirect("/platform?message=Event deleted.");
}

export async function deletePlatformPrayerRequest(formData: FormData) {
  await requirePlatformEngineer();
  const id = getFormString(formData, "request_id");
  const confirmation = getFormString(formData, "confirmation");

  if (!id || confirmation !== "DELETE") {
    redirect("/platform?message=Type DELETE to confirm prayer request deletion.");
  }

  const admin = createAdminClient();
  const { data: request, error: lookupError } = await admin
    .from("prayer_requests")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!request) {
    redirect("/platform?message=Prayer request not found.");
  }

  const { error } = await admin.from("prayer_requests").delete().eq("id", id);

  if (error) {
    await logPlatformMutation("prayer_request_delete", "failed", error);
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  await logPlatformMutation("prayer_request_delete", "succeeded");
  revalidatePath("/platform");
  revalidatePath("/prayer");
  redirect("/platform?message=Prayer request deleted.");
}

export async function createPlatformDirectMessageIntent(formData: FormData) {
  const profile = await requirePlatformEngineer();
  await assertNotBanned(profile.user_id, "/platform?message=Your account cannot send messages right now.");
  const targetUserId = getFormString(formData, "target_user_id");
  const subject = getFormString(formData, "subject");
  const body = getFormString(formData, "body");

  if (!targetUserId || !subject || !body) {
    redirect("/platform?message=Choose a user and enter a message subject and body.");
  }

  const conversationId = await createOrGetDirectConversationForCurrentUser(targetUserId);
  await insertDirectMessageForCurrentUser(conversationId, `${subject}\n\n${body}`);

  revalidatePath("/platform");
  redirect(`/messages/${conversationId}`);
}

export async function createTemporaryBan(formData: FormData) {
  const profile = await requirePlatformEngineer();
  const bannedUserId = getFormString(formData, "banned_user_id");
  const reason = getFormString(formData, "reason");
  const duration = getFormString(formData, "duration");
  const now = new Date();
  let expiresAt: Date | null = null;

  if (duration === "3_days") {
    expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  } else if (duration === "1_week") {
    expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else if (duration === "1_month") {
    expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  } else if (duration === "custom") {
    const customUntil = getFormString(formData, "custom_until");
    expiresAt = customUntil ? new Date(customUntil) : null;
  }

  if (!bannedUserId || !reason || !expiresAt || Number.isNaN(expiresAt.getTime())) {
    redirect("/platform?message=Choose a user, reason, and valid ban duration.");
  }

  if (expiresAt <= now) {
    redirect("/platform?message=Ban expiration must be in the future.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("user_bans").insert({
    banned_user_id: bannedUserId,
    banned_by: profile.id,
    reason,
    starts_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    await logPlatformMutation("temporary_ban_create", "failed", error);
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  await logPlatformMutation("temporary_ban_create", "succeeded");
  revalidatePath("/platform");
  redirect("/platform?message=Temporary ban created.");
}
