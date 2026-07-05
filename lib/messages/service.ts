import "server-only";

import { revalidatePath } from "next/cache";
import { getCurrentAuthUser } from "@/lib/auth/current";
import { createNotification } from "@/lib/notifications/service";
import { createAdminClient } from "@/lib/supabase/admin";

const MESSAGE_MAX_LENGTH = 5000;

function previewMessage(body: string) {
  const compact = body.replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
}

async function findDirectConversation(userA: string, userB: string) {
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
    if (!userIds.has(userA) || !userIds.has(userB)) {
      continue;
    }

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

  return null;
}

async function assertTargetHasNotBlockedActor(actorUserId: string, targetUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_blocks")
    .select("id")
    .eq("blocker_id", targetUserId)
    .eq("blocked_user_id", actorUserId)
    .limit(1);

  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      return;
    }

    throw new Error(error.message);
  }

  if ((data || []).length > 0) {
    throw new Error("That profile is not available for direct messages.");
  }
}

export async function createOrGetDirectConversationForCurrentUser(targetUserId: string) {
  const actor = await getCurrentAuthUser();

  if (actor.id === targetUserId) {
    throw new Error("Choose someone other than yourself.");
  }

  await assertTargetHasNotBlockedActor(actor.id, targetUserId);

  const existingConversationId = await findDirectConversation(actor.id, targetUserId);

  if (existingConversationId) {
    return existingConversationId;
  }

  const admin = createAdminClient();
  const { data: targetProfile, error: targetError } = await admin
    .from("profiles")
    .select("user_id")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetError) {
    throw new Error(targetError.message);
  }

  if (!targetProfile) {
    throw new Error("That profile is not available for direct messages.");
  }

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
    { conversation_id: conversationId, user_id: actor.id, last_read_at: new Date().toISOString() },
    { conversation_id: conversationId, user_id: targetUserId },
  ]);

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  return conversationId;
}

export async function insertDirectMessageForCurrentUser(conversationId: string, body: string) {
  const actor = await getCurrentAuthUser();
  const trimmedBody = body.trim();

  if (!trimmedBody || trimmedBody.length > MESSAGE_MAX_LENGTH) {
    throw new Error("Message must contain between 1 and 5000 characters.");
  }

  const admin = createAdminClient();
  const { data: participantRows, error: participantError } = await admin
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId);

  if (participantError) {
    throw new Error(participantError.message);
  }

  const participantIds = (participantRows || []).map((row) => String(row.user_id));

  if (!participantIds.includes(actor.id)) {
    throw new Error("Conversation not found.");
  }

  const recipients = participantIds.filter((userId) => userId !== actor.id);
  const { data: blockRows, error: blockError } = await admin
    .from("user_blocks")
    .select("blocker_id")
    .eq("blocked_user_id", actor.id)
    .in("blocker_id", recipients);

  if (blockError && blockError.code !== "42P01" && blockError.code !== "42703") {
    throw new Error(blockError.message);
  }

  if ((blockRows || []).length > 0) {
    throw new Error("This conversation is unavailable.");
  }

  const { data: message, error } = await admin
    .from("direct_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: actor.id,
      body: trimmedBody,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await Promise.all(
    recipients.map((recipientId) =>
      createNotification({
        userId: recipientId,
        actorUserId: actor.id,
        type: "direct_message",
        title: "New message",
        body: previewMessage(trimmedBody),
        href: `/messages/${conversationId}`,
      }),
    ),
  );

  await admin
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", actor.id);

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/platform/messages");
  revalidatePath(`/platform/messages/${conversationId}`);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");

  return String(message.id);
}
