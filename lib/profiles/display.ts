import { createAdminClient } from "@/lib/supabase/admin";

export type DisplayProfile = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

function normalizeDisplayProfile(row: Record<string, unknown>): DisplayProfile {
  const fallbackName = typeof row.username === "string" && row.username ? row.username : "Member";

  return {
    user_id: String(row.user_id),
    display_name: typeof row.display_name === "string" && row.display_name ? row.display_name : fallbackName,
    avatar_url: typeof row.avatar_url === "string" && row.avatar_url ? row.avatar_url : null,
  };
}

export async function getDisplayProfile(userId: string): Promise<DisplayProfile> {
  const profiles = await getDisplayProfiles([userId]);
  return profiles.get(userId) || { user_id: userId, display_name: "Member", avatar_url: null };
}

export async function getDisplayProfiles(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const profiles = new Map<string, DisplayProfile>();

  if (uniqueUserIds.length === 0) {
    return profiles;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("user_id,display_name,username,avatar_url")
    .in("user_id", uniqueUserIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data || []) as unknown as Record<string, unknown>[]) {
    if (typeof row.user_id === "string") {
      profiles.set(row.user_id, normalizeDisplayProfile(row));
    }
  }

  return profiles;
}
