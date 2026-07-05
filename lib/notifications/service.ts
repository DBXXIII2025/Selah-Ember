import "server-only";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreateNotificationInput = {
  userId: string | null | undefined;
  actorUserId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
};

export async function createNotification({
  userId,
  actorUserId = null,
  type,
  title,
  body = null,
  href = null,
}: CreateNotificationInput) {
  if (!userId || userId === actorUserId) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    actor_user_id: actorUserId,
    type,
    title,
    body,
    href,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/notifications");
}
