"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type NotificationRecord = {
  id: string;
  user_id: string;
  actor_user_id: string | null;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

export async function getNotifications(): Promise<NotificationRecord[]> {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .select("id,user_id,actor_user_id,type,title,body,href,read_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as unknown as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    actor_user_id: typeof row.actor_user_id === "string" ? row.actor_user_id : null,
    type: String(row.type),
    title: String(row.title),
    body: typeof row.body === "string" ? row.body : null,
    href: typeof row.href === "string" ? row.href : null,
    read_at: typeof row.read_at === "string" ? row.read_at : null,
    created_at: String(row.created_at),
  }));
}

export async function getUnreadNotificationCount() {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

export async function markNotificationRead(formData: FormData) {
  const notificationId = getFormString(formData, "notification_id");

  if (!notificationId) {
    redirect("/notifications");
  }

  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  redirect("/notifications");
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  redirect("/notifications");
}
