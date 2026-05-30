import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActiveBan = {
  id: string;
  reason: string;
  starts_at: string;
  expires_at: string;
};

export async function getActiveBanForUser(userId: string): Promise<ActiveBan | null> {
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_bans")
    .select("id,reason,starts_at,expires_at")
    .eq("banned_user_id", userId)
    .lte("starts_at", now)
    .gt("expires_at", now)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return null;
    }

    throw new Error(error.message);
  }

  return data as ActiveBan | null;
}

export async function assertNotBanned(userId: string, redirectTo = "/account-restricted") {
  const ban = await getActiveBanForUser(userId);

  if (ban) {
    redirect(redirectTo);
  }
}
