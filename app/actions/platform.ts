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
    author_id: string;
    author_name: string | null;
    created_at: string;
    deleted_at: string | null;
  }>;
  community_post_comments: Array<{
    id: string;
    post_id: string;
    body: string;
    author_id: string;
    author_name: string | null;
    created_at: string;
    deleted_at: string | null;
  }>;
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
    reportsResult,
    discussionReportsResult,
    mediaResult,
    communityPostsResult,
    communityCommentsResult,
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
    ...((communityPostsResult.data || []) as unknown as Record<string, unknown>[]).map((row) => String(row.author_id)),
    ...((communityCommentsResult.data || []) as unknown as Record<string, unknown>[]).map((row) => String(row.author_id)),
  ];
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
    prayer_requests: ((prayerResult.data || []) as unknown as PlatformDashboardData["prayer_requests"]),
    bans: ((bansResult.data || []) as unknown as PlatformDashboardData["bans"]),
    message_reports: ((reportsResult.data || []) as unknown as PlatformDashboardData["message_reports"]),
    discussion_reports: ((discussionReportsResult.data || []) as unknown as PlatformDashboardData["discussion_reports"]),
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
      const authorId = String(row.author_id);
      return {
        id: String(row.id),
        title: typeof row.title === "string" ? row.title : null,
        body: typeof row.body === "string" ? row.body : null,
        author_id: authorId,
        author_name: communityAuthors.get(authorId)?.display_name || "Member",
        created_at: String(row.created_at),
        deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
      };
    }),
    community_post_comments: ((communityCommentsResult.data || []) as unknown as Record<string, unknown>[]).map((row) => {
      const authorId = String(row.author_id);
      return {
        id: String(row.id),
        post_id: String(row.post_id),
        body: String(row.body),
        author_id: authorId,
        author_name: communityAuthors.get(authorId)?.display_name || "Member",
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
