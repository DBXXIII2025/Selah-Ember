"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformEngineer } from "@/lib/platform/auth";
import { isSafeHttpUrl } from "@/lib/media/validation";

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
  prayer_requests: Array<{ id: string; title: string; created_at: string; is_private: boolean }>;
  bans: Array<{
    id: string;
    banned_user_id: string;
    reason: string;
    starts_at: string;
    expires_at: string;
    created_at: string;
  }>;
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

async function getUserEmailMap() {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    throw new Error(error.message);
  }

  return new Map(data.users.map((user) => [user.id, user.email || null]));
}

export async function getPlatformDashboardData(search = ""): Promise<PlatformDashboardData> {
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
    prayerResult,
    bansResult,
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
    prayerResult,
    bansResult,
  ]) {
    if (result.error) {
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
    prayer_requests: ((prayerResult.data || []) as unknown as PlatformDashboardData["prayer_requests"]),
    bans: ((bansResult.data || []) as unknown as PlatformDashboardData["bans"]),
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
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/platform");
  redirect("/platform?message=Site settings updated.");
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

  revalidatePath("/platform");
  revalidatePath("/notifications");
  redirect("/platform?message=Announcement sent.");
}

export async function createPlatformDirectMessageIntent(formData: FormData) {
  const profile = await requirePlatformEngineer();
  const targetUserId = getFormString(formData, "target_user_id");
  const subject = getFormString(formData, "subject");
  const body = getFormString(formData, "body");

  if (!targetUserId || !subject || !body) {
    redirect("/platform?message=Choose a user and enter a message subject and body.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("platform_direct_message_intents").insert({
    target_user_id: targetUserId,
    started_by: profile.id,
    subject,
    body,
  });

  if (error) {
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/platform");
  redirect("/platform?message=Direct message intent saved for Phase 13 messaging.");
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
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/platform");
  redirect("/platform?message=Temporary ban created.");
}
