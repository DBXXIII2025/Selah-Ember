"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createOrGetDirectConversationForCurrentUser } from "@/lib/messages/service";
import { createNotification } from "@/lib/notifications/service";
import { isAllowedMessageReaction } from "@/lib/messages/reactions";
import { assertNotBanned } from "@/lib/moderation/bans";
import {
  isSafeHttpUrl,
  MEDIA_LIMITS,
  validateImageFile,
  validateVideoFile,
} from "@/lib/media/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MESSAGE_MAX_LENGTH = 5000;
const MESSAGE_MEDIA_BUCKET = "message-media";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MessageAttachment = {
  id: string;
  message_id: string;
  conversation_id: string;
  uploader_id: string;
  kind: "image" | "video" | "link" | "file";
  url: string;
  signed_url: string | null;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type MessageReaction = {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
};

export type MessageParticipant = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  last_read_at: string | null;
  archived_at: string | null;
};

export type ConversationSummary = {
  id: string;
  current_user_id: string;
  updated_at: string;
  participants: MessageParticipant[];
  latest_message: {
    body: string;
    sender_id: string;
    created_at: string;
    deleted_at: string | null;
  } | null;
  unread_count: number;
  is_archived: boolean;
};

export type ConversationDetail = ConversationSummary & {
  messages: Array<{
    id: string;
    sender_id: string;
    body: string;
    created_at: string;
    deleted_at: string | null;
    attachments: MessageAttachment[];
    read_by_others: boolean;
    reactions: MessageReaction[];
  }>;
};

export type MessageUserSearchResult = {
  user_id: string;
  display_name: string;
  username: string | null;
  church_name: string | null;
  avatar_url: string | null;
};

export type ConversationListOptions = {
  search?: string;
  view?: "active" | "archived";
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function previewMessage(body: string) {
  const compact = body.replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
}

function getOptionalFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!(value instanceof File) || value.size <= 0 || !value.name) {
    return null;
  }

  return value;
}

function getConversationRedirectPath(formData: FormData, conversationId: string) {
  const returnTo = getFormString(formData, "return_to");

  if (returnTo === `/messages/${conversationId}` || returnTo === `/platform/messages/${conversationId}`) {
    return returnTo;
  }

  return `/messages/${conversationId}`;
}

function getScopedReturnPath(formData: FormData, conversationId: string) {
  return getConversationRedirectPath(formData, conversationId);
}

function sanitizeFilename(name: string) {
  const fallback = "message-media";
  const sanitized = name
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

  return sanitized || fallback;
}

function getAttachmentKind(file: File): "image" | "video" | null {
  if (MEDIA_LIMITS.allowedImageMimeTypes.includes(file.type)) {
    return "image";
  }

  if (MEDIA_LIMITS.allowedVideoMimeTypes.includes(file.type)) {
    return "video";
  }

  return null;
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function logMessageIssue(
  event: string,
  details: {
    conversationId?: string;
    userId?: string;
    code?: string;
    message?: string;
  } = {},
) {
  console.warn("[messages]", event, {
    conversationId: details.conversationId,
    userId: details.userId,
    code: details.code,
    message: details.message,
  });
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

async function getCurrentUserRole(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.role === "string" ? data.role : "user";
}

async function getVisibleMessageProfile(targetUserId: string, currentUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("user_id")
    .eq("user_id", targetUserId)
    .neq("user_id", currentUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getConversationParticipantUserIds(conversationId: string) {
  if (!isUuid(conversationId)) {
    logMessageIssue("invalid_conversation_id", { conversationId });
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId);

  if (error) {
    logMessageIssue("participant_lookup_failed", {
      conversationId,
      code: error.code,
      message: error.message,
    });
    return null;
  }

  return (data || []).map((row) => String(row.user_id));
}

function messagePath(conversationId: string, message: string) {
  return `/messages/${conversationId}?message=${encodeURIComponent(message)}`;
}

function normalizeSearch(value = "") {
  return value.trim().toLowerCase();
}

function conversationMatchesSearch(conversation: ConversationSummary, search: string) {
  const term = normalizeSearch(search);

  if (!term) {
    return true;
  }

  const participantText = conversation.participants
    .filter((participant) => participant.user_id !== conversation.current_user_id)
    .flatMap((participant) => [participant.display_name, participant.username || ""])
    .join(" ")
    .toLowerCase();
  const latestText = (conversation.latest_message?.body || "").toLowerCase();

  return participantText.includes(term) || latestText.includes(term);
}

async function requireConversationParticipant(conversationId: string, userId: string) {
  const participantIds = await getConversationParticipantUserIds(conversationId);

  if (!participantIds?.includes(userId)) {
    logMessageIssue("conversation_inaccessible", { conversationId, userId });
    redirect("/messages?message=Conversation not found.");
  }

  return participantIds;
}

async function getBlockingUsersForSender(conversationId: string, senderId: string) {
  const participantIds = await getConversationParticipantUserIds(conversationId);

  if (!participantIds) {
    return null;
  }

  const recipients = participantIds.filter((userId) => userId !== senderId);

  if (recipients.length === 0) {
    return [];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_blocks")
    .select("blocker_id")
    .eq("blocked_user_id", senderId)
    .in("blocker_id", recipients);

  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []).map((row) => String(row.blocker_id));
}

async function assertCanMessageParticipants(conversationId: string, senderId: string, redirectPath: string) {
  const blockingUsers = await getBlockingUsersForSender(conversationId, senderId);

  if (!blockingUsers) {
    redirect(`${redirectPath}?message=Conversation not found.`);
  }

  if (blockingUsers.length > 0) {
    redirect(`${redirectPath}?message=This conversation is unavailable.`);
  }
}

async function assertCanStartConversation(starterUserId: string, targetUserId: string, redirectPath: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_blocks")
    .select("id")
    .eq("blocker_id", targetUserId)
    .eq("blocked_user_id", starterUserId)
    .limit(1);

  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      return;
    }

    throw new Error(error.message);
  }

  if ((data || []).length > 0) {
    redirect(`${redirectPath}?message=That profile is not available for direct messages.`);
  }
}

async function createSignedAttachmentUrl(attachment: MessageAttachment) {
  if (attachment.kind !== "image" && attachment.kind !== "video") {
    return attachment;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(MESSAGE_MEDIA_BUCKET)
    .createSignedUrl(attachment.url, 60 * 60);

  if (error) {
    logMessageIssue("message_media_signed_url_failed", {
      conversationId: attachment.conversation_id,
      userId: attachment.uploader_id,
      code: error.name,
      message: error.message,
    });
    return attachment;
  }

  return {
    ...attachment,
    signed_url: data.signedUrl,
  };
}

async function getAttachmentsForMessages(messageIds: string[]) {
  const validMessageIds = messageIds.filter(isUuid);

  if (validMessageIds.length === 0) {
    return new Map<string, MessageAttachment[]>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("message_attachments")
    .select("id,message_id,conversation_id,uploader_id,kind,url,filename,mime_type,size_bytes,created_at")
    .in("message_id", validMessageIds)
    .order("created_at", { ascending: true });

  if (error) {
    logMessageIssue("message_attachment_lookup_failed", {
      code: error.code,
      message: error.message,
    });
    return new Map<string, MessageAttachment[]>();
  }

  const attachments = await Promise.all(
    (data || []).map(async (row) =>
      createSignedAttachmentUrl({
        id: String(row.id),
        message_id: String(row.message_id),
        conversation_id: String(row.conversation_id),
        uploader_id: String(row.uploader_id),
        kind: ["image", "video", "link", "file"].includes(String(row.kind))
          ? (String(row.kind) as MessageAttachment["kind"])
          : "file",
        url: String(row.url),
        signed_url: null,
        filename: typeof row.filename === "string" ? row.filename : null,
        mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
        size_bytes:
          typeof row.size_bytes === "number"
            ? row.size_bytes
            : typeof row.size_bytes === "string"
              ? Number(row.size_bytes)
              : null,
        created_at: String(row.created_at),
      }),
    ),
  );

  const attachmentsByMessage = new Map<string, MessageAttachment[]>();

  for (const attachment of attachments) {
    attachmentsByMessage.set(attachment.message_id, [
      ...(attachmentsByMessage.get(attachment.message_id) || []),
      attachment,
    ]);
  }

  return attachmentsByMessage;
}

async function getReactionsForMessages(messageIds: string[]) {
  const validMessageIds = messageIds.filter(isUuid);

  if (validMessageIds.length === 0) {
    return new Map<string, MessageReaction[]>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("message_reactions")
    .select("id,message_id,user_id,reaction,created_at")
    .in("message_id", validMessageIds)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42P01") {
      return new Map<string, MessageReaction[]>();
    }

    logMessageIssue("message_reaction_lookup_failed", {
      code: error.code,
      message: error.message,
    });
    return new Map<string, MessageReaction[]>();
  }

  const reactionsByMessage = new Map<string, MessageReaction[]>();

  for (const row of data || []) {
    const reaction = {
      id: String(row.id),
      message_id: String(row.message_id),
      user_id: String(row.user_id),
      reaction: String(row.reaction),
      created_at: String(row.created_at),
    };

    reactionsByMessage.set(reaction.message_id, [
      ...(reactionsByMessage.get(reaction.message_id) || []),
      reaction,
    ]);
  }

  return reactionsByMessage;
}

async function insertMessageAttachmentRows(
  messageId: string,
  conversationId: string,
  uploaderId: string,
  attachments: Array<{
    kind: "image" | "video" | "link";
    url: string;
    filename?: string | null;
    mime_type?: string | null;
    size_bytes?: number | null;
  }>,
) {
  if (attachments.length === 0) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("message_attachments").insert(
    attachments.map((attachment) => ({
      message_id: messageId,
      conversation_id: conversationId,
      uploader_id: uploaderId,
      kind: attachment.kind,
      url: attachment.url,
      filename: attachment.filename || null,
      mime_type: attachment.mime_type || null,
      size_bytes: attachment.size_bytes || null,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getUnreadMessageCount() {
  const conversations = await getConversations();
  return conversations.reduce((total, conversation) => total + conversation.unread_count, 0);
}

async function buildConversationSummaries(conversationIds: string[], currentUserId: string) {
  const validConversationIds = conversationIds.filter(isUuid);

  if (validConversationIds.length === 0) {
    return [];
  }

  const admin = createAdminClient();
  const [conversationResult, participantResult, messageResult] = await Promise.all([
    admin
      .from("conversations")
      .select("id,updated_at")
      .in("id", validConversationIds)
      .order("updated_at", { ascending: false }),
    admin
      .from("conversation_participants")
      .select("conversation_id,user_id,last_read_at,archived_at")
      .in("conversation_id", validConversationIds),
    admin
      .from("direct_messages")
      .select("id,conversation_id,sender_id,body,created_at,deleted_at")
      .in("conversation_id", validConversationIds)
      .order("created_at", { ascending: false }),
  ]);

  if (conversationResult.error) {
    logMessageIssue("conversation_summary_lookup_failed", {
      code: conversationResult.error.code,
      message: conversationResult.error.message,
    });
    return [];
  }

  if (participantResult.error) {
    logMessageIssue("conversation_participant_summary_lookup_failed", {
      code: participantResult.error.code,
      message: participantResult.error.message,
    });
    return [];
  }

  if (messageResult.error) {
    logMessageIssue("conversation_message_summary_lookup_failed", {
      code: messageResult.error.code,
      message: messageResult.error.message,
    });
    return [];
  }

  const participantRows = participantResult.data || [];
  const participantUserIds = Array.from(new Set(participantRows.map((row) => String(row.user_id))));
  const profilesByUserId = new Map<string, { display_name?: string; username?: string | null; avatar_url?: string | null }>();

  if (participantUserIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("user_id,display_name,username,avatar_url")
      .in("user_id", participantUserIds);

    if (profilesError) {
      logMessageIssue("conversation_profile_lookup_failed", {
        code: profilesError.code,
        message: profilesError.message,
      });
    } else {
      for (const profile of profiles || []) {
        if (typeof profile.user_id !== "string") {
          continue;
        }

        profilesByUserId.set(profile.user_id, {
          display_name: typeof profile.display_name === "string" ? profile.display_name : undefined,
          username: typeof profile.username === "string" ? profile.username : null,
          avatar_url: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
        });
      }
    }
  }

  const participantsByConversation = new Map<string, MessageParticipant[]>();
  const readStateByConversation = new Map<string, string | null>();
  const archiveStateByConversation = new Map<string, string | null>();

  for (const row of participantRows) {
    const conversationId = String(row.conversation_id);
    const profile = profilesByUserId.get(String(row.user_id));
    const participant = {
      user_id: String(row.user_id),
      display_name: typeof profile?.display_name === "string" ? profile.display_name : "Selah Ember Member",
      username: typeof profile?.username === "string" ? profile.username : null,
      avatar_url: typeof profile?.avatar_url === "string" ? profile.avatar_url : null,
      last_read_at: typeof row.last_read_at === "string" ? row.last_read_at : null,
      archived_at: typeof row.archived_at === "string" ? row.archived_at : null,
    };

    participantsByConversation.set(conversationId, [
      ...(participantsByConversation.get(conversationId) || []),
      participant,
    ]);

    if (participant.user_id === currentUserId) {
      readStateByConversation.set(conversationId, participant.last_read_at);
      archiveStateByConversation.set(conversationId, participant.archived_at);
    }
  }

  const messagesByConversation = new Map<string, ConversationDetail["messages"]>();

  for (const row of messageResult.data || []) {
    const conversationId = String(row.conversation_id);
    messagesByConversation.set(conversationId, [
      ...(messagesByConversation.get(conversationId) || []),
      {
        id: String(row.id),
        sender_id: String(row.sender_id),
        body: String(row.body),
        created_at: String(row.created_at),
        deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
        attachments: [],
        read_by_others: false,
        reactions: [],
      },
    ]);
  }

  return (conversationResult.data || []).map((conversation) => {
    const conversationId = String(conversation.id);
    const messages = messagesByConversation.get(conversationId) || [];
    const lastReadAt = readStateByConversation.get(conversationId);
    const unreadCount = messages.filter((message) => {
      if (message.sender_id === currentUserId || message.deleted_at) {
        return false;
      }

      return !lastReadAt || new Date(message.created_at) > new Date(lastReadAt);
    }).length;

    return {
      id: conversationId,
      current_user_id: currentUserId,
      updated_at: String(conversation.updated_at),
      participants: participantsByConversation.get(conversationId) || [],
      latest_message: messages[0] || null,
      unread_count: unreadCount,
      is_archived: Boolean(archiveStateByConversation.get(conversationId)),
    };
  });
}

export async function getConversations(options: ConversationListOptions = {}): Promise<ConversationSummary[]> {
  const user = await getCurrentUser();
  const view = options.view === "archived" ? "archived" : "active";
  const admin = createAdminClient();
  let query = admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", user.id);

  query = view === "archived" ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  const { data, error } = await query;

  if (error) {
    logMessageIssue("conversation_list_lookup_failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
    });
    return [];
  }

  const conversationIds = (data || []).map((row) => String(row.conversation_id));
  const conversations = await buildConversationSummaries(conversationIds, user.id);
  return conversations.filter((conversation) => conversationMatchesSearch(conversation, options.search || ""));
}

export async function getConversation(conversationId: string): Promise<ConversationDetail | null> {
  const user = await getCurrentUser();

  if (!isUuid(conversationId)) {
    logMessageIssue("conversation_detail_invalid_id", { conversationId, userId: user.id });
    return null;
  }

  const participantIds = await getConversationParticipantUserIds(conversationId);

  if (!participantIds?.includes(user.id)) {
    logMessageIssue("conversation_detail_inaccessible", { conversationId, userId: user.id });
    return null;
  }

  const [summary] = await buildConversationSummaries([conversationId], user.id);

  if (!summary) {
    logMessageIssue("conversation_detail_missing_summary", { conversationId, userId: user.id });
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("direct_messages")
    .select("id,sender_id,body,created_at,deleted_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    logMessageIssue("conversation_detail_messages_failed", {
      conversationId,
      userId: user.id,
      code: error.code,
      message: error.message,
    });
    return null;
  }

  const messages = (data || []).map((row) => ({
    id: String(row.id),
    sender_id: String(row.sender_id),
    body: String(row.body),
    created_at: String(row.created_at),
    deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
    attachments: [],
    read_by_others: summary.participants.some((participant) => {
      if (participant.user_id === row.sender_id || !participant.last_read_at) {
        return false;
      }

      return new Date(String(participant.last_read_at)) >= new Date(String(row.created_at));
    }),
    reactions: [],
  }));
  const messageIds = messages.map((message) => message.id);
  const [attachmentsByMessage, reactionsByMessage] = await Promise.all([
    getAttachmentsForMessages(messageIds),
    getReactionsForMessages(messageIds),
  ]);

  return {
    ...summary,
    messages: messages.map((message) => ({
      ...message,
      attachments: attachmentsByMessage.get(message.id) || [],
      reactions: reactionsByMessage.get(message.id) || [],
    })),
  };
}

export async function searchMessageUsers(search = ""): Promise<MessageUserSearchResult[]> {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const term = search.trim().replace(/[,%()]/g, " ");
  let query = admin
    .from("profiles")
    .select("user_id,display_name,username,church_name,avatar_url")
    .not("user_id", "is", null)
    .neq("user_id", user.id)
    .order("display_name", { ascending: true })
    .limit(25);

  if (term) {
    query = query.or(`display_name.ilike.%${term}%,username.ilike.%${term}%,church_name.ilike.%${term}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row) => ({
    user_id: String(row.user_id),
    display_name: String(row.display_name),
    username: typeof row.username === "string" ? row.username : null,
    church_name: typeof row.church_name === "string" ? row.church_name : null,
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
  }));
}

export async function startDirectConversation(formData: FormData) {
  const user = await getCurrentUser();
  await assertNotBanned(user.id, "/messages/new?message=Your account cannot start messages right now.");
  const targetUserId = getFormString(formData, "target_user_id");

  if (!targetUserId) {
    redirect("/messages/new?message=Choose someone to message.");
  }

  if (targetUserId === user.id) {
    redirect("/messages/new?message=Choose someone other than yourself.");
  }

  const role = await getCurrentUserRole(user.id);
  const targetIsVisible = await getVisibleMessageProfile(targetUserId, user.id);

  if (role !== "platform_engineer" && !targetIsVisible) {
    redirect("/messages/new?message=That profile is not available for direct messages.");
  }

  await assertCanStartConversation(user.id, targetUserId, "/messages/new");
  const conversationId = await createOrGetDirectConversationForCurrentUser(targetUserId);
  revalidatePath("/messages");
  redirect(`/messages/${conversationId}`);
}

export async function sendDirectMessage(formData: FormData) {
  const user = await getCurrentUser();
  await assertNotBanned(user.id, "/messages?message=Your account cannot send messages right now.");
  const conversationId = getFormString(formData, "conversation_id");
  const body = getFormString(formData, "body");
  const linkUrl = getFormString(formData, "link_url");
  const file = getOptionalFile(formData, "attachment");

  if (!conversationId) {
    redirect("/messages?message=Conversation not found.");
  }

  const redirectPath = getConversationRedirectPath(formData, conversationId);

  if (body.length > MESSAGE_MAX_LENGTH) {
    redirect(`${redirectPath}?message=Message must be 5000 characters or fewer.`);
  }

  if (linkUrl && !isSafeHttpUrl(linkUrl)) {
    redirect(`${redirectPath}?message=Use a safe HTTP or HTTPS link.`);
  }

  let fileKind: "image" | "video" | null = null;

  if (file) {
    fileKind = getAttachmentKind(file);

    if (!fileKind) {
      redirect(`${redirectPath}?message=Use a JPG, PNG, WebP, GIF, MP4, WebM, or MOV file.`);
    }

    const validation =
      fileKind === "image"
        ? validateImageFile(file, { maxBytes: MEDIA_LIMITS.postImageBytes })
        : validateVideoFile(file);

    if (!validation.ok) {
      redirect(`${redirectPath}?message=${encodeURIComponent(validation.message || "Invalid upload.")}`);
    }
  }

  if (!body && !linkUrl && !file) {
    redirect(`${redirectPath}?message=Enter a message, link, image, or video.`);
  }

  const participantIds = await requireConversationParticipant(conversationId, user.id);
  await assertCanMessageParticipants(conversationId, user.id, redirectPath);
  const admin = createAdminClient();
  const uploadAttachments: Array<{
    kind: "image" | "video" | "link";
    url: string;
    filename?: string | null;
    mime_type?: string | null;
    size_bytes?: number | null;
  }> = [];

  if (file && fileKind) {
    const safeName = sanitizeFilename(file.name);
    const path = `${conversationId}/${user.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await admin.storage
      .from(MESSAGE_MEDIA_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logMessageIssue("message_media_upload_failed", {
        conversationId,
        userId: user.id,
        code: uploadError.name,
        message: uploadError.message,
      });
      redirect(`${redirectPath}?message=Upload failed. Try again.`);
    }

    uploadAttachments.push({
      kind: fileKind,
      url: path,
      filename: safeName,
      mime_type: file.type,
      size_bytes: file.size,
    });
  }

  if (linkUrl) {
    uploadAttachments.push({
      kind: "link",
      url: linkUrl,
    });
  }

  const messageBody =
    body ||
    (linkUrl
      ? linkUrl
      : fileKind === "video"
        ? "Shared a video."
        : fileKind === "image"
          ? "Shared an image."
          : "Shared an attachment.");

  const { data: message, error } = await admin
    .from("direct_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: messageBody,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await insertMessageAttachmentRows(String(message.id), conversationId, user.id, uploadAttachments);

  const recipients = participantIds.filter((userId) => userId !== user.id);

  await Promise.all(
    recipients.map((recipientId) =>
      createNotification({
        userId: recipientId,
        actorUserId: user.id,
        type: "direct_message",
        title: "New message",
        body: previewMessage(messageBody),
        href: `/messages/${conversationId}`,
      }),
    ),
  );

  const now = new Date().toISOString();
  await admin
    .from("conversation_participants")
    .update({ last_read_at: now, archived_at: null })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/platform/messages");
  revalidatePath(`/platform/messages/${conversationId}`);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  redirect(redirectPath);
}

export async function archiveConversation(formData: FormData) {
  const user = await getCurrentUser();
  const conversationId = getFormString(formData, "conversation_id");

  if (!conversationId || !isUuid(conversationId)) {
    redirect("/messages?message=Conversation not found.");
  }

  await requireConversationParticipant(conversationId, user.id);
  const admin = createAdminClient();
  const { error } = await admin
    .from("conversation_participants")
    .update({ archived_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/messages?message=${encodeURIComponent("Could not archive conversation.")}`);
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  redirect("/messages?message=Conversation archived.");
}

export async function unarchiveConversation(formData: FormData) {
  const user = await getCurrentUser();
  const conversationId = getFormString(formData, "conversation_id");

  if (!conversationId || !isUuid(conversationId)) {
    redirect("/messages?view=archived&message=Conversation not found.");
  }

  await requireConversationParticipant(conversationId, user.id);
  const admin = createAdminClient();
  const { error } = await admin
    .from("conversation_participants")
    .update({ archived_at: null })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/messages?view=archived&message=${encodeURIComponent("Could not unarchive conversation.")}`);
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  redirect("/messages?view=archived&message=Conversation restored.");
}

export async function deleteOwnMessage(formData: FormData) {
  const user = await getCurrentUser();
  const conversationId = getFormString(formData, "conversation_id");
  const messageId = getFormString(formData, "message_id");

  if (!conversationId || !messageId || !isUuid(conversationId) || !isUuid(messageId)) {
    redirect("/messages?message=Message not found.");
  }

  await requireConversationParticipant(conversationId, user.id);
  const admin = createAdminClient();
  const { data: message, error: lookupError } = await admin
    .from("direct_messages")
    .select("id,sender_id")
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!message || String(message.sender_id) !== user.id) {
    redirect(messagePath(conversationId, "You can only delete your own messages."));
  }

  const { error } = await admin
    .from("direct_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("sender_id", user.id);

  if (error) {
    redirect(messagePath(conversationId, "Could not delete message."));
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/platform/messages");
  revalidatePath(`/platform/messages/${conversationId}`);
  redirect(messagePath(conversationId, "Message deleted."));
}

export async function reportConversationOrMessage(formData: FormData) {
  const user = await getCurrentUser();
  const conversationId = getFormString(formData, "conversation_id");
  const messageId = getFormString(formData, "message_id");
  const reason = getFormString(formData, "reason");
  const details = getFormString(formData, "details");

  if (!conversationId || !isUuid(conversationId)) {
    redirect("/messages?message=Conversation not found.");
  }

  if (!reason) {
    redirect(messagePath(conversationId, "Choose a report reason."));
  }

  if (messageId && !isUuid(messageId)) {
    redirect(messagePath(conversationId, "Message not found."));
  }

  await requireConversationParticipant(conversationId, user.id);
  const admin = createAdminClient();

  if (messageId) {
    const { data: message, error: messageError } = await admin
      .from("direct_messages")
      .select("id")
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (messageError) {
      throw new Error(messageError.message);
    }

    if (!message) {
      redirect(messagePath(conversationId, "Message not found."));
    }
  }

  const { error } = await admin.from("message_reports").insert({
    reporter_id: user.id,
    conversation_id: conversationId,
    message_id: messageId || null,
    reason,
    details: details || null,
  });

  if (error) {
    if (error.code === "42P01") {
      redirect(messagePath(conversationId, "Reports are not available until the latest database migration is applied."));
    }

    throw new Error(error.message);
  }

  revalidatePath("/platform");
  redirect(messagePath(conversationId, "Report submitted."));
}

export async function blockUser(formData: FormData) {
  const user = await getCurrentUser();
  const conversationId = getFormString(formData, "conversation_id");
  const blockedUserId = getFormString(formData, "blocked_user_id");

  if (!conversationId || !blockedUserId || !isUuid(conversationId) || !isUuid(blockedUserId)) {
    redirect("/messages?message=Block request could not be completed.");
  }

  if (blockedUserId === user.id) {
    redirect(messagePath(conversationId, "You cannot block yourself."));
  }

  const participantIds = await requireConversationParticipant(conversationId, user.id);

  if (!participantIds.includes(blockedUserId)) {
    redirect(messagePath(conversationId, "That user is not in this conversation."));
  }

  const admin = createAdminClient();
  const { error } = await admin.from("user_blocks").upsert(
    {
      blocker_id: user.id,
      blocked_user_id: blockedUserId,
    },
    {
      onConflict: "blocker_id,blocked_user_id",
    },
  );

  if (error) {
    if (error.code === "42P01") {
      redirect(messagePath(conversationId, "Blocking is not available until the latest database migration is applied."));
    }

    throw new Error(error.message);
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  redirect(messagePath(conversationId, "User blocked."));
}

async function getReactableMessage(messageId: string, userId: string) {
  if (!isUuid(messageId)) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("direct_messages")
    .select("id,conversation_id,deleted_at")
    .eq("id", messageId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const conversationId = String(data.conversation_id);
  const participantIds = await getConversationParticipantUserIds(conversationId);

  if (!participantIds?.includes(userId)) {
    return null;
  }

  return {
    id: String(data.id),
    conversation_id: conversationId,
    deleted_at: typeof data.deleted_at === "string" ? data.deleted_at : null,
  };
}

export async function addMessageReaction(formData: FormData) {
  const user = await getCurrentUser();
  await assertNotBanned(user.id, "/messages?message=Your account cannot react right now.");
  const messageId = getFormString(formData, "message_id");
  const reaction = getFormString(formData, "reaction");
  const message = await getReactableMessage(messageId, user.id);

  if (!message) {
    redirect("/messages?message=Message not found.");
  }

  const redirectPath = getScopedReturnPath(formData, message.conversation_id);

  if (message.deleted_at) {
    redirect(`${redirectPath}?message=Deleted messages cannot be reacted to.`);
  }

  if (!isAllowedMessageReaction(reaction)) {
    redirect(`${redirectPath}?message=Choose a supported reaction.`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("message_reactions").upsert(
    {
      message_id: message.id,
      user_id: user.id,
      reaction,
    },
    {
      onConflict: "message_id,user_id,reaction",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    if (error.code === "42P01") {
      redirect(`${redirectPath}?message=Reactions are not available until the latest database migration is applied.`);
    }

    throw new Error(error.message);
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${message.conversation_id}`);
  revalidatePath("/platform/messages");
  revalidatePath(`/platform/messages/${message.conversation_id}`);
  redirect(redirectPath);
}

export async function removeMessageReaction(formData: FormData) {
  const user = await getCurrentUser();
  const messageId = getFormString(formData, "message_id");
  const reaction = getFormString(formData, "reaction");
  const message = await getReactableMessage(messageId, user.id);

  if (!message) {
    redirect("/messages?message=Message not found.");
  }

  const redirectPath = getScopedReturnPath(formData, message.conversation_id);

  if (!isAllowedMessageReaction(reaction)) {
    redirect(`${redirectPath}?message=Choose a supported reaction.`);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("message_reactions")
    .delete()
    .eq("message_id", message.id)
    .eq("user_id", user.id)
    .eq("reaction", reaction);

  if (error) {
    if (error.code === "42P01") {
      redirect(`${redirectPath}?message=Reactions are not available until the latest database migration is applied.`);
    }

    throw new Error(error.message);
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${message.conversation_id}`);
  revalidatePath("/platform/messages");
  revalidatePath(`/platform/messages/${message.conversation_id}`);
  redirect(redirectPath);
}

export async function markConversationRead(conversationId: string) {
  const user = await getCurrentUser();

  if (!isUuid(conversationId)) {
    logMessageIssue("mark_read_invalid_id", { conversationId, userId: user.id });
    return;
  }

  const participantIds = await getConversationParticipantUserIds(conversationId);

  if (!participantIds?.includes(user.id)) {
    logMessageIssue("mark_read_inaccessible", { conversationId, userId: user.id });
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  if (error) {
    logMessageIssue("mark_read_failed", {
      conversationId,
      userId: user.id,
      code: error.code,
      message: error.message,
    });
    return;
  }
}
