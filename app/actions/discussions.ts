"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotification } from "@/lib/notifications/service";
import {
  getCurrentAuthAndProfile as resolveCurrentAuthAndProfile,
  getOptionalAuthAndProfile as resolveOptionalAuthAndProfile,
} from "@/lib/auth/current";
import { assertNotBanned } from "@/lib/moderation/bans";
import { createAdminClient } from "@/lib/supabase/admin";

const TITLE_MAX_LENGTH = 160;
const BODY_MAX_LENGTH = 10000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Profile = {
  id: string;
  authUserId: string;
  display_name: string;
  username: string | null;
  role: string;
};

type CommunityAccess = {
  state: "signed_out" | "missing" | "non_member" | "allowed";
  isSignedIn: boolean;
  isMember: boolean;
  role: string | null;
  ownerCheckPassed: boolean;
  membershipCheckPassed: boolean;
  membershipResultCount: number;
};

type GroupAccess = CommunityAccess;

export type DiscussionAuthor = {
  user_id: string;
  display_name: string;
  username: string | null;
};

export type DiscussionThreadSummary = {
  id: string;
  scope_type: "community" | "group";
  community_id: string | null;
  group_id: string | null;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  reply_count: number;
  author: DiscussionAuthor;
};

export type DiscussionReply = {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  author: DiscussionAuthor;
};

export type DiscussionThreadDetail = DiscussionThreadSummary & {
  replies: DiscussionReply[];
};

export type CommunityDiscussionData = {
  community: {
    id: string;
    name: string;
    slug: string | null;
  } | null;
  state: "signed_out" | "missing" | "non_member" | "allowed";
  isSignedIn: boolean;
  isMember: boolean;
  role: string | null;
  threads: DiscussionThreadSummary[];
};

export type GroupDiscussionData = {
  group: {
    id: string;
    title: string;
  } | null;
  state: "signed_out" | "missing" | "non_member" | "allowed";
  isSignedIn: boolean;
  isMember: boolean;
  role: string | null;
  threads: DiscussionThreadSummary[];
};

export type DiscussionThreadData = {
  thread: DiscussionThreadDetail | null;
  state: "signed_out" | "missing" | "non_member" | "allowed";
  isSignedIn: boolean;
  isMember: boolean;
  role: string | null;
  current_user_id: string | null;
  current_user_role: string | null;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function previewText(body: string) {
  const compact = body.replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
}

function safeMessage(message: string) {
  return encodeURIComponent(message);
}

function safeReturnPath(path: string, fallback: string) {
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function discussionLog(
  event: string,
  details: {
    userId?: string;
    profileId?: string;
    threadId?: string;
    communityId?: string;
    groupId?: string;
    ownerCheckPassed?: boolean;
    membershipCheckPassed?: boolean;
    membershipResultCount?: number;
    code?: string;
    message?: string;
  } = {},
) {
  console.warn("[discussions]", event, {
    userId: details.userId,
    profileId: details.profileId,
    threadId: details.threadId,
    communityId: details.communityId,
    groupId: details.groupId,
    ownerCheckPassed: details.ownerCheckPassed,
    membershipCheckPassed: details.membershipCheckPassed,
    membershipResultCount: details.membershipResultCount,
    code: details.code,
    message: details.message,
  });
}

async function getOptionalProfile() {
  const result = await resolveOptionalAuthAndProfile();
  if (!result) {
    return null;
  }

  return {
    id: result.profile.id,
    authUserId: result.user.id,
    display_name: result.profile.display_name,
    username: result.profile.username,
    role: result.profile.role,
  };
}

async function getCurrentProfile() {
  const result = await resolveCurrentAuthAndProfile();
  return {
    id: result.profile.id,
    authUserId: result.user.id,
    display_name: result.profile.display_name,
    username: result.profile.username,
    role: result.profile.role,
  };
}

async function getCommunity(communityId: string) {
  if (!isUuid(communityId)) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("churches")
    .select("id,name,slug,is_published,created_by")
    .eq("id", communityId)
    .maybeSingle();

  if (error) {
    discussionLog("community_lookup_failed", { communityId, code: error.code, message: error.message });
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: String(data.id),
    name: String(data.name),
    slug: typeof data.slug === "string" ? data.slug : null,
    is_published: data.is_published !== false,
    created_by: typeof data.created_by === "string" ? data.created_by : null,
  };
}

async function getGroup(groupId: string) {
  if (!isUuid(groupId)) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("study_groups")
    .select("id,title,name,created_by")
    .eq("id", groupId)
    .maybeSingle();

  if (error) {
    discussionLog("group_lookup_failed", { groupId, code: error.code, message: error.message });
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: String(data.id),
    title: typeof data.title === "string" ? data.title : String(data.name || "Study group"),
    created_by: typeof data.created_by === "string" ? data.created_by : null,
  };
}

async function getOptionalAuthContext() {
  const result = await resolveOptionalAuthAndProfile();

  if (!result) {
    return null;
  }

  return {
    user: result.user,
    profile: {
      id: result.profile.id,
      authUserId: result.user.id,
      display_name: result.profile.display_name,
      username: result.profile.username,
      role: result.profile.role,
    },
  };
}

async function getCommunityAccess(communityId: string): Promise<CommunityAccess> {
  const context = await getOptionalAuthContext();

  if (!context) {
    return {
      state: "signed_out",
      isSignedIn: false,
      isMember: false,
      role: null,
      ownerCheckPassed: false,
      membershipCheckPassed: false,
      membershipResultCount: 0,
    };
  }

  const admin = createAdminClient();
  const [{ data: community, error: communityError }, { data: membershipRows, count, error: membershipError }] =
    await Promise.all([
      admin.from("churches").select("created_by").eq("id", communityId).maybeSingle(),
      admin
        .from("church_memberships")
        .select("id", { count: "exact" })
        .eq("church_id", communityId)
        .eq("profile_id", context.profile.id),
    ]);

  if (communityError) {
    discussionLog("community_lookup_failed", {
      communityId,
      userId: context.user.id,
      profileId: context.profile.id,
      code: communityError.code,
      message: communityError.message,
    });
  }

  if (membershipError) {
    discussionLog("community_membership_lookup_failed", {
      communityId,
      userId: context.user.id,
      profileId: context.profile.id,
      code: membershipError.code,
      message: membershipError.message,
    });
  }

  const ownerCheckPassed = typeof community?.created_by === "string" && community.created_by === context.profile.id;
  const {
    data: communityAccessAllowed,
    error: communityAccessError,
  } = await admin.rpc("can_access_community_discussions", {
    target_church_id: communityId,
    target_auth_user_id: context.user.id,
    target_profile_id: context.profile.id,
  });

  if (communityAccessError) {
    discussionLog("community_access_rpc_failed", {
      communityId,
      userId: context.user.id,
      profileId: context.profile.id,
      code: communityAccessError.code,
      message: communityAccessError.message,
    });
  }

  const membershipCheckPassed = communityAccessAllowed === true;
  const membershipResultCount = typeof count === "number" ? count : Array.isArray(membershipRows) ? membershipRows.length : 0;

  return {
    state: ownerCheckPassed || membershipCheckPassed ? "allowed" : "non_member",
    isSignedIn: true,
    isMember: ownerCheckPassed || membershipCheckPassed,
    role: ownerCheckPassed ? "owner" : membershipResultCount > 0 ? "member" : null,
    ownerCheckPassed,
    membershipCheckPassed,
    membershipResultCount,
  };
}

async function getGroupAccess(groupId: string): Promise<GroupAccess> {
  const context = await getOptionalAuthContext();

  if (!context) {
    return {
      state: "signed_out",
      isSignedIn: false,
      isMember: false,
      role: null,
      ownerCheckPassed: false,
      membershipCheckPassed: false,
      membershipResultCount: 0,
    };
  }

  const admin = createAdminClient();
  const [{ data: group, error: groupError }, { data: membershipRows, count, error: membershipError }] =
    await Promise.all([
      admin.from("study_groups").select("created_by").eq("id", groupId).maybeSingle(),
      admin
        .from("group_memberships")
        .select("id,role", { count: "exact" })
        .eq("group_id", groupId)
        .eq("profile_id", context.profile.id),
    ]);

  if (groupError) {
    discussionLog("group_lookup_failed", {
      groupId,
      userId: context.user.id,
      profileId: context.profile.id,
      code: groupError.code,
      message: groupError.message,
    });
  }

  if (membershipError) {
    discussionLog("group_membership_lookup_failed", {
      groupId,
      userId: context.user.id,
      profileId: context.profile.id,
      code: membershipError.code,
      message: membershipError.message,
    });
  }

  const ownerCheckPassed = typeof group?.created_by === "string" && group.created_by === context.profile.id;
  const {
    data: groupAccessAllowed,
    error: groupAccessError,
  } = await admin.rpc("can_access_group_discussions", {
    target_group_id: groupId,
    target_auth_user_id: context.user.id,
    target_profile_id: context.profile.id,
  });

  if (groupAccessError) {
    discussionLog("group_access_rpc_failed", {
      groupId,
      userId: context.user.id,
      profileId: context.profile.id,
      code: groupAccessError.code,
      message: groupAccessError.message,
    });
  }

  const directMembershipCount = typeof count === "number" ? count : Array.isArray(membershipRows) ? membershipRows.length : 0;
  const membershipRole = Array.isArray(membershipRows) && membershipRows.length > 0 ? (membershipRows[0] as Record<string, unknown>).role : null;
  const directMembershipPassed = directMembershipCount > 0;
  const membershipCheckPassed = groupAccessAllowed === true || directMembershipPassed || ownerCheckPassed;
  const membershipResultCount = membershipCheckPassed ? Math.max(1, directMembershipCount) : directMembershipCount;

  return {
    state: membershipCheckPassed ? "allowed" : "non_member",
    isSignedIn: true,
    isMember: membershipCheckPassed,
    role: ownerCheckPassed ? "owner" : typeof membershipRole === "string" ? membershipRole : membershipResultCount > 0 ? "member" : null,
    ownerCheckPassed,
    membershipCheckPassed,
    membershipResultCount,
  };
}

async function getAuthorMap(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const fallback = new Map<string, DiscussionAuthor>();

  for (const userId of uniqueUserIds) {
    fallback.set(userId, {
      user_id: userId,
      display_name: "Selah Ember Member",
      username: null,
    });
  }

  if (uniqueUserIds.length === 0) {
    return fallback;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("user_id,display_name,username")
    .in("user_id", uniqueUserIds);

  if (error) {
    discussionLog("author_lookup_failed", { code: error.code, message: error.message });
    return fallback;
  }

  for (const profile of data || []) {
    const userId = String(profile.user_id);
    fallback.set(userId, {
      user_id: userId,
      display_name: typeof profile.display_name === "string" ? profile.display_name : "Selah Ember Member",
      username: typeof profile.username === "string" ? profile.username : null,
    });
  }

  return fallback;
}

async function getReplyCounts(threadIds: string[]) {
  const counts = new Map<string, number>();

  if (threadIds.length === 0) {
    return counts;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discussion_replies")
    .select("thread_id")
    .in("thread_id", threadIds);

  if (error) {
    discussionLog("reply_count_lookup_failed", { code: error.code, message: error.message });
    return counts;
  }

  for (const row of data || []) {
    const threadId = String(row.thread_id);
    counts.set(threadId, (counts.get(threadId) || 0) + 1);
  }

  return counts;
}

async function normalizeThreads(rows: Record<string, unknown>[]) {
  const authorMap = await getAuthorMap(rows.map((row) => String(row.author_id)));
  const replyCounts = await getReplyCounts(rows.map((row) => String(row.id)));

  return rows.map((row) => {
    const authorId = String(row.author_id);

    return {
      id: String(row.id),
      scope_type: row.scope_type === "group" ? "group" : "community",
      community_id: typeof row.community_id === "string" ? row.community_id : null,
      group_id: typeof row.group_id === "string" ? row.group_id : null,
      author_id: authorId,
      title: String(row.title),
      body: String(row.body),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
      reply_count: replyCounts.get(String(row.id)) || 0,
      author: authorMap.get(authorId) || {
        user_id: authorId,
        display_name: "Selah Ember Member",
        username: null,
      },
    } satisfies DiscussionThreadSummary;
  });
}

async function getThreadRow(threadId: string) {
  if (!isUuid(threadId)) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discussion_threads")
    .select("id,scope_type,community_id,group_id,author_id,title,body,created_at,updated_at,deleted_at")
    .eq("id", threadId)
    .maybeSingle();

  if (error) {
    discussionLog("thread_lookup_failed", { threadId, code: error.code, message: error.message });
    return null;
  }

  return data as Record<string, unknown> | null;
}

async function canReadThread(thread: Record<string, unknown>, profile: Profile | null): Promise<CommunityAccess> {
  if (!profile) {
    return {
      state: "signed_out",
      isSignedIn: false,
      isMember: false,
      role: null,
      ownerCheckPassed: false,
      membershipCheckPassed: false,
      membershipResultCount: 0,
    };
  }

  if (thread.scope_type === "community" && typeof thread.community_id === "string") {
    return getCommunityAccess(thread.community_id);
  }

  if (thread.scope_type === "group" && typeof thread.group_id === "string") {
    return getGroupAccess(thread.group_id);
  }

  return {
    state: "missing",
    isSignedIn: true,
    isMember: false,
    role: null,
    ownerCheckPassed: false,
    membershipCheckPassed: false,
    membershipResultCount: 0,
  };
}

async function getThreadDetail(threadId: string, profile: Profile | null): Promise<DiscussionThreadDetail | null> {
  const threadRow = await getThreadRow(threadId);

  if (!threadRow) {
    return null;
  }

  const access = await canReadThread(threadRow, profile);

  if (!access.isMember) {
    discussionLog("thread_inaccessible", { threadId, userId: profile?.authUserId });
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discussion_replies")
    .select("id,thread_id,author_id,body,created_at,updated_at,deleted_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    discussionLog("reply_lookup_failed", { threadId, code: error.code, message: error.message });
    return null;
  }

  const [thread] = await normalizeThreads([threadRow]);
  const replyRows = (data || []) as unknown as Record<string, unknown>[];
  const authorMap = await getAuthorMap(replyRows.map((reply) => String(reply.author_id)));
  const replies = replyRows.map((reply) => {
    const authorId = String(reply.author_id);

    return {
      id: String(reply.id),
      thread_id: String(reply.thread_id),
      author_id: authorId,
      body: String(reply.body),
      created_at: String(reply.created_at),
      updated_at: String(reply.updated_at),
      deleted_at: typeof reply.deleted_at === "string" ? reply.deleted_at : null,
      author: authorMap.get(authorId) || {
        user_id: authorId,
        display_name: "Selah Ember Member",
        username: null,
      },
    };
  });

  return { ...thread, replies };
}

export async function getCommunityThreads(communityId: string): Promise<CommunityDiscussionData> {
  const [profile, community] = await Promise.all([getOptionalProfile(), getCommunity(communityId)]);

  if (!community) {
    discussionLog("community_discussion_community_unavailable", {
      communityId,
      userId: profile?.authUserId,
      profileId: profile?.id,
      ownerCheckPassed: false,
      membershipCheckPassed: false,
      membershipResultCount: 0,
    });
    return { community: null, state: "missing", isSignedIn: Boolean(profile), isMember: false, role: null, threads: [] };
  }

  if (!profile) {
    return { community, state: "signed_out", isSignedIn: false, isMember: false, role: null, threads: [] };
  }

  const access = await getCommunityAccess(communityId);
  const { role } = access;
  const isMember = access.isMember;

  if (!isMember) {
    discussionLog("community_discussion_access_denied", {
      communityId,
      userId: profile.authUserId,
      profileId: profile.id,
      ownerCheckPassed: access.ownerCheckPassed,
      membershipCheckPassed: access.membershipCheckPassed,
      membershipResultCount: access.membershipResultCount,
    });
    return { community, state: "non_member", isSignedIn: true, isMember: false, role: null, threads: [] };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discussion_threads")
    .select("id,scope_type,community_id,group_id,author_id,title,body,created_at,updated_at,deleted_at")
    .eq("scope_type", "community")
    .eq("community_id", communityId)
    .order("updated_at", { ascending: false });

  if (error) {
    discussionLog("community_threads_lookup_failed", {
      communityId,
      userId: profile.authUserId,
      profileId: profile.id,
      code: error.code,
      message: error.message,
    });
    return { community, state: "allowed", isSignedIn: true, isMember, role, threads: [] };
  }

  const threads = await normalizeThreads((data || []) as unknown as Record<string, unknown>[]);
  return { community, state: "allowed", isSignedIn: true, isMember, role, threads };
}

export async function getGroupThreads(groupId: string): Promise<GroupDiscussionData> {
  const [profile, group] = await Promise.all([getOptionalProfile(), getGroup(groupId)]);

  if (!group) {
    discussionLog("group_discussion_group_unavailable", {
      groupId,
      userId: profile?.authUserId,
      profileId: profile?.id,
      ownerCheckPassed: false,
      membershipCheckPassed: false,
      membershipResultCount: 0,
    });
    return { group: null, state: "missing", isSignedIn: Boolean(profile), isMember: false, role: null, threads: [] };
  }

  if (!profile) {
    return { group, state: "signed_out", isSignedIn: false, isMember: false, role: null, threads: [] };
  }

  const access = await getGroupAccess(groupId);
  const { role } = access;
  const isMember = access.isMember;

  if (!isMember) {
    discussionLog("group_discussion_access_denied", {
      groupId,
      userId: profile.authUserId,
      profileId: profile.id,
      ownerCheckPassed: access.ownerCheckPassed,
      membershipCheckPassed: access.membershipCheckPassed,
      membershipResultCount: access.membershipResultCount,
    });
    return { group, state: "non_member", isSignedIn: true, isMember: false, role: null, threads: [] };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discussion_threads")
    .select("id,scope_type,community_id,group_id,author_id,title,body,created_at,updated_at,deleted_at")
    .eq("scope_type", "group")
    .eq("group_id", groupId)
    .order("updated_at", { ascending: false });

  if (error) {
    discussionLog("group_threads_lookup_failed", {
      groupId,
      userId: profile.authUserId,
      profileId: profile.id,
      code: error.code,
      message: error.message,
    });
    return { group, state: "allowed", isSignedIn: true, isMember, role, threads: [] };
  }

  const threads = await normalizeThreads((data || []) as unknown as Record<string, unknown>[]);
  return { group, state: "allowed", isSignedIn: true, isMember, role, threads };
}

export async function getDiscussionThread(threadId: string): Promise<DiscussionThreadData> {
  const profile = await getOptionalProfile();
  const threadRow = await getThreadRow(threadId);

  if (!threadRow) {
    return {
      thread: null,
      state: "missing",
      isSignedIn: Boolean(profile),
      isMember: false,
      role: null,
      current_user_id: profile?.authUserId || null,
      current_user_role: profile?.role || null,
    };
  }

  const access = await canReadThread(threadRow, profile);

  if (!access.isMember) {
    return {
      thread: null,
      ...access,
      current_user_id: profile?.authUserId || null,
      current_user_role: profile?.role || null,
    };
  }

  const thread = await getThreadDetail(threadId, profile);
  return {
    ...access,
    state: "allowed",
    thread,
    current_user_id: profile?.authUserId || null,
    current_user_role: profile?.role || null,
  };
}

async function notifyGroupLeaders(groupId: string, actorUserId: string, threadId: string, title: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("group_memberships")
    .select("profiles:profile_id(user_id)")
    .eq("group_id", groupId)
    .in("role", ["owner", "leader"]);

  if (error) {
    throw new Error(error.message);
  }

  await Promise.all(
    ((data || []) as unknown as Record<string, unknown>[]).map((membership) => {
      const leaderProfile = membership.profiles as { user_id?: string } | null | undefined;
      return createNotification({
        userId: leaderProfile?.user_id,
        actorUserId,
        type: "discussion_thread",
        title: "New group discussion",
        body: previewText(title),
        href: `/groups/${groupId}/discussions/${threadId}`,
      });
    }),
  );
}

function validateThreadInput(title: string, body: string, redirectPath: string) {
  if (!title) {
    redirect(`${redirectPath}?message=Title is required.`);
  }

  if (title.length > TITLE_MAX_LENGTH) {
    redirect(`${redirectPath}?message=Title must be 160 characters or fewer.`);
  }

  if (!body) {
    redirect(`${redirectPath}?message=Discussion body is required.`);
  }

  if (body.length > BODY_MAX_LENGTH) {
    redirect(`${redirectPath}?message=Discussion body must be 10000 characters or fewer.`);
  }
}

function validateReplyInput(body: string, redirectPath: string) {
  if (!body) {
    redirect(`${redirectPath}?message=Reply cannot be empty.`);
  }

  if (body.length > BODY_MAX_LENGTH) {
    redirect(`${redirectPath}?message=Reply must be 10000 characters or fewer.`);
  }
}

export async function createCommunityThread() {
  redirect("/community?message=Community discussions have moved to the open community feed and groups.");
}

export async function createGroupThread(formData: FormData) {
  const profile = await getCurrentProfile();
  await assertNotBanned(profile.authUserId, "/groups?message=Your account cannot create discussions right now.");
  const groupId = getFormString(formData, "group_id");
  const title = getFormString(formData, "title");
  const body = getFormString(formData, "body");
  const redirectPath = `/groups/${groupId}/discussions/new`;

  if (!groupId || !isUuid(groupId)) {
    redirect("/groups?message=Group not found.");
  }

  validateThreadInput(title, body, redirectPath);

  const access = await getGroupAccess(groupId);

  if (!access.isMember) {
    redirect(`/groups/${groupId}/discussions?message=Join this group to start a discussion.`);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discussion_threads")
    .insert({
      scope_type: "group",
      group_id: groupId,
      author_id: profile.authUserId,
      title,
      body,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`${redirectPath}?message=${safeMessage(error.message)}`);
  }

  const threadId = String(data.id);
  await notifyGroupLeaders(groupId, profile.authUserId, threadId, title);

  revalidatePath(`/groups/${groupId}/discussions`);
  revalidatePath(`/groups/${groupId}/discussions/${threadId}`);
  revalidatePath("/notifications");
  redirect(`/groups/${groupId}/discussions/${threadId}`);
}

export async function createDiscussionReply(formData: FormData) {
  const profile = await getCurrentProfile();
  await assertNotBanned(profile.authUserId, "/messages?message=Your account cannot reply right now.");
  const threadId = getFormString(formData, "thread_id");
  const body = getFormString(formData, "body");
  const returnPath = safeReturnPath(getFormString(formData, "return_path"), "/communities");

  if (!threadId || !isUuid(threadId)) {
    redirect(`${returnPath}?message=Discussion not found.`);
  }

  validateReplyInput(body, returnPath);

  const thread = await getThreadRow(threadId);

  if (!thread) {
    redirect(`${returnPath}?message=Discussion not found.`);
  }

  const access = await canReadThread(thread, profile);

  if (!access.isMember) {
    redirect(`${returnPath}?message=Discussion unavailable.`);
  }

  if (typeof thread.deleted_at === "string") {
    redirect(`${returnPath}?message=Deleted discussions cannot receive replies.`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("discussion_replies").insert({
    thread_id: threadId,
    author_id: profile.authUserId,
    body,
  });

  if (error) {
    redirect(`${returnPath}?message=${safeMessage(error.message)}`);
  }

  if (String(thread.author_id) !== profile.authUserId) {
    await createNotification({
      userId: String(thread.author_id),
      actorUserId: profile.authUserId,
      type: "discussion_reply",
      title: "New discussion reply",
      body: previewText(body),
      href: returnPath,
    });
  }

  revalidatePath(returnPath);
  revalidatePath("/notifications");
  redirect(returnPath);
}

export async function deleteOwnThread(formData: FormData) {
  const profile = await getCurrentProfile();
  const threadId = getFormString(formData, "thread_id");
  const returnPath = safeReturnPath(getFormString(formData, "return_path"), "/communities");

  if (!threadId || !isUuid(threadId)) {
    redirect(`${returnPath}?message=Discussion not found.`);
  }

  const thread = await getThreadRow(threadId);

  if (!thread) {
    redirect(`${returnPath}?message=Discussion not found.`);
  }

  const access =
    thread.scope_type === "community" && typeof thread.community_id === "string"
      ? await getCommunityAccess(thread.community_id)
      : thread.scope_type === "group" && typeof thread.group_id === "string"
        ? await getGroupAccess(thread.group_id)
        : null;

  const isAuthor = String(thread.author_id) === profile.authUserId;
  const isPlatformEngineer = profile.role === "platform_engineer";
  const isModerator =
    thread.scope_type === "community"
      ? access?.role === "owner"
      : thread.scope_type === "group"
        ? access?.role === "owner" || access?.role === "leader"
        : false;

  if (!isAuthor && !isModerator && !isPlatformEngineer) {
    redirect(`${returnPath}?message=You can only delete your own discussion.`);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("discussion_threads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("author_id", profile.authUserId);

  if (error) {
    redirect(`${returnPath}?message=${safeMessage("Could not delete discussion.")}`);
  }

  revalidatePath(returnPath);
  redirect(`${returnPath}?message=Discussion deleted.`);
}

export async function deleteOwnReply(formData: FormData) {
  const profile = await getCurrentProfile();
  const replyId = getFormString(formData, "reply_id");
  const returnPath = safeReturnPath(getFormString(formData, "return_path"), "/communities");

  if (!replyId || !isUuid(replyId)) {
    redirect(`${returnPath}?message=Reply not found.`);
  }

  const admin = createAdminClient();
  const { data: reply, error: lookupError } = await admin
    .from("discussion_replies")
    .select("id,thread_id,author_id")
    .eq("id", replyId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!reply) {
    redirect(`${returnPath}?message=Reply not found.`);
  }

  const { data: thread, error: threadError } = await admin
    .from("discussion_threads")
    .select("id,scope_type,community_id,group_id,author_id")
    .eq("id", String(reply.thread_id))
    .maybeSingle();

  if (threadError) {
    throw new Error(threadError.message);
  }

  const access =
    thread && thread.scope_type === "community" && typeof thread.community_id === "string"
      ? await getCommunityAccess(thread.community_id)
      : thread && thread.scope_type === "group" && typeof thread.group_id === "string"
        ? await getGroupAccess(thread.group_id)
        : null;

  const isAuthor = String(reply.author_id) === profile.authUserId;
  const isPlatformEngineer = profile.role === "platform_engineer";
  const isModerator =
    thread?.scope_type === "community"
      ? access?.role === "owner"
      : thread?.scope_type === "group"
        ? access?.role === "owner" || access?.role === "leader"
        : false;

  if (!isAuthor && !isModerator && !isPlatformEngineer) {
    redirect(`${returnPath}?message=You can only delete your own reply.`);
  }

  const { error } = await admin
    .from("discussion_replies")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", replyId)
    .eq("author_id", profile.authUserId);

  if (error) {
    redirect(`${returnPath}?message=${safeMessage("Could not delete reply.")}`);
  }

  revalidatePath(returnPath);
  redirect(`${returnPath}?message=Reply deleted.`);
}

export async function reportDiscussionThread(formData: FormData) {
  const profile = await getCurrentProfile();
  const threadId = getFormString(formData, "thread_id");
  const reason = getFormString(formData, "reason") || "Concern";
  const details = getFormString(formData, "details");
  const returnPath = safeReturnPath(getFormString(formData, "return_path"), "/communities");

  if (!threadId || !isUuid(threadId)) {
    redirect(`${returnPath}?message=Discussion not found.`);
  }

  const thread = await getThreadRow(threadId);

  if (!thread) {
    redirect(`${returnPath}?message=Discussion not found.`);
  }

  const access = await canReadThread(thread, profile);

  if (!access.isMember) {
    redirect(`${returnPath}?message=Discussion unavailable.`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("discussion_reports").insert({
    reporter_id: profile.authUserId,
    thread_id: threadId,
    reason,
    details: details || null,
  });

  if (error) {
    redirect(`${returnPath}?message=${safeMessage(error.message)}`);
  }

  revalidatePath("/platform");
  redirect(`${returnPath}?message=Report submitted.`);
}

export async function reportDiscussionReply(formData: FormData) {
  const profile = await getCurrentProfile();
  const replyId = getFormString(formData, "reply_id");
  const reason = getFormString(formData, "reason") || "Concern";
  const details = getFormString(formData, "details");
  const returnPath = safeReturnPath(getFormString(formData, "return_path"), "/communities");

  if (!replyId || !isUuid(replyId)) {
    redirect(`${returnPath}?message=Reply not found.`);
  }

  const admin = createAdminClient();
  const { data: reply, error: lookupError } = await admin
    .from("discussion_replies")
    .select("id,thread_id")
    .eq("id", replyId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!reply) {
    redirect(`${returnPath}?message=Reply not found.`);
  }

  const thread = await getThreadRow(String(reply.thread_id));
  const access = thread ? await canReadThread(thread, profile) : { isMember: false };

  if (!thread || !access.isMember) {
    redirect(`${returnPath}?message=Discussion unavailable.`);
  }

  const { error } = await admin.from("discussion_reports").insert({
    reporter_id: profile.authUserId,
    thread_id: String(reply.thread_id),
    reply_id: replyId,
    reason,
    details: details || null,
  });

  if (error) {
    redirect(`${returnPath}?message=${safeMessage(error.message)}`);
  }

  revalidatePath("/platform");
  redirect(`${returnPath}?message=Report submitted.`);
}
