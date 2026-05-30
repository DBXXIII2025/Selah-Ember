"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotification } from "@/app/actions/notifications";
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

export type MessageParticipant = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  last_read_at: string | null;
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
};

export type ConversationDetail = ConversationSummary & {
  messages: Array<{
    id: string;
    sender_id: string;
    body: string;
    created_at: string;
    deleted_at: string | null;
    attachments: MessageAttachment[];
  }>;
};

export type MessageUserSearchResult = {
  user_id: string;
  display_name: string;
  username: string | null;
  church_name: string | null;
  avatar_url: string | null;
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

async function requireConversationParticipant(conversationId: string, userId: string) {
  const participantIds = await getConversationParticipantUserIds(conversationId);

  if (!participantIds?.includes(userId)) {
    logMessageIssue("conversation_inaccessible", { conversationId, userId });
    redirect("/messages?message=Conversation not found.");
  }

  return participantIds;
}

export async function findDirectConversation(userA: string, userB: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("conversation_participants")
    .select("conversation_id,user_id")
    .in("user_id", [userA, userB]);

  if (error) {
    throw new Error(error.message);
  }

  const matches = new Map<string, Set<string>>();

  for (const row of data || []) {
    const conversationId = String(row.conversation_id);
    const userId = String(row.user_id);
    matches.set(conversationId, (matches.get(conversationId) || new Set()).add(userId));
  }

  for (const [conversationId, userIds] of matches) {
    if (userIds.has(userA) && userIds.has(userB)) {
      const { count, error: countError } = await admin
        .from("conversation_participants")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId);

      if (countError) {
        throw new Error(countError.message);
      }

      if (count === 2) {
        return conversationId;
      }
    }
  }

  return null;
}

export async function createOrGetDirectConversation(starterUserId: string, targetUserId: string) {
  if (starterUserId === targetUserId) {
    redirect("/messages/new?message=Choose someone other than yourself.");
  }

  const existingConversationId = await findDirectConversation(starterUserId, targetUserId);

  if (existingConversationId) {
    return existingConversationId;
  }

  const admin = createAdminClient();
  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .insert({})
    .select("id")
    .single();

  if (conversationError) {
    throw new Error(conversationError.message);
  }

  const conversationId = String(conversation.id);
  const { error: participantsError } = await admin.from("conversation_participants").insert([
    { conversation_id: conversationId, user_id: starterUserId, last_read_at: new Date().toISOString() },
    { conversation_id: conversationId, user_id: targetUserId },
  ]);

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  return conversationId;
}

export async function insertDirectMessage(conversationId: string, senderId: string, body: string) {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    redirect(`/messages/${conversationId}?message=Message cannot be empty.`);
  }

  if (trimmedBody.length > MESSAGE_MAX_LENGTH) {
    redirect(`/messages/${conversationId}?message=Message must be 5000 characters or fewer.`);
  }

  const participantIds = await requireConversationParticipant(conversationId, senderId);
  const admin = createAdminClient();
  const { data: message, error } = await admin
    .from("direct_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmedBody,
    })
    .select("id,created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const recipients = participantIds.filter((userId) => userId !== senderId);

  await Promise.all(
    recipients.map((recipientId) =>
      createNotification({
        userId: recipientId,
        actorUserId: senderId,
        type: "direct_message",
        title: "New message",
        body: previewMessage(trimmedBody),
        href: `/messages/${conversationId}`,
      }),
    ),
  );

  const now = new Date().toISOString();
  await admin
    .from("conversation_participants")
    .update({ last_read_at: now })
    .eq("conversation_id", conversationId)
    .eq("user_id", senderId);

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");

  return String(message.id);
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
      .select("conversation_id,user_id,last_read_at")
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

  for (const row of participantRows) {
    const conversationId = String(row.conversation_id);
    const profile = profilesByUserId.get(String(row.user_id));
    const participant = {
      user_id: String(row.user_id),
      display_name: typeof profile?.display_name === "string" ? profile.display_name : "Selah Ember Member",
      username: typeof profile?.username === "string" ? profile.username : null,
      avatar_url: typeof profile?.avatar_url === "string" ? profile.avatar_url : null,
      last_read_at: typeof row.last_read_at === "string" ? row.last_read_at : null,
    };

    participantsByConversation.set(conversationId, [
      ...(participantsByConversation.get(conversationId) || []),
      participant,
    ]);

    if (participant.user_id === currentUserId) {
      readStateByConversation.set(conversationId, participant.last_read_at);
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
    };
  });
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", user.id);

  if (error) {
    logMessageIssue("conversation_list_lookup_failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
    });
    return [];
  }

  const conversationIds = (data || []).map((row) => String(row.conversation_id));
  return buildConversationSummaries(conversationIds, user.id);
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
  }));
  const attachmentsByMessage = await getAttachmentsForMessages(messages.map((message) => message.id));

  return {
    ...summary,
    messages: messages.map((message) => ({
      ...message,
      attachments: attachmentsByMessage.get(message.id) || [],
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

  const conversationId = await createOrGetDirectConversation(user.id, targetUserId);
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
    .update({ last_read_at: now })
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
