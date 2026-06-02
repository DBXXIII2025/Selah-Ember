"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuthAndProfile, getOptionalAuthAndProfile } from "@/lib/auth/current";
import { canCreateEvent } from "@/lib/auth/ownership";
import { assertNotBanned } from "@/lib/moderation/bans";
import { requirePlatformEngineer } from "@/lib/platform/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MIN_GIFT_CENTS = 100;
const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_NOTE_LENGTH = 1000;

export type GivingCampaign = {
  id: string;
  community_id: string;
  created_by: string;
  title: string;
  description: string | null;
  goal_amount_cents: number | null;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  total_completed_cents: number;
  intent_count: number;
  community?: {
    name: string | null;
    slug: string | null;
  };
};

export type GivingIntent = {
  id: string;
  community_id: string;
  campaign_id: string | null;
  giver_id: string | null;
  amount_cents: number;
  currency: string;
  giver_name: string | null;
  giver_email: string | null;
  note: string | null;
  status: "draft" | "pending" | "completed" | "failed" | "cancelled";
  created_at: string;
  campaign_title?: string | null;
  community?: {
    name: string | null;
    slug: string | null;
  };
};

type CommunityRecord = {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  is_published: boolean;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  return value.length > 0 ? value : null;
}

function safeReturnPath(path: string, fallback: string) {
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function parseDollarAmountToCents(value: string) {
  const normalized = value.replace(/[$,\s]/g, "");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [dollars, cents = ""] = normalized.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}

function mapCommunity(row: Record<string, unknown>): CommunityRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    created_by: typeof row.created_by === "string" ? row.created_by : null,
    is_published: row.is_published !== false,
  };
}

function mapCampaign(row: Record<string, unknown>, totals = new Map<string, { amount: number; count: number }>()): GivingCampaign {
  const total = totals.get(String(row.id)) || { amount: 0, count: 0 };
  const community = row.churches as { name?: string; slug?: string } | null | undefined;

  return {
    id: String(row.id),
    community_id: String(row.community_id),
    created_by: String(row.created_by),
    title: String(row.title),
    description: typeof row.description === "string" ? row.description : null,
    goal_amount_cents:
      typeof row.goal_amount_cents === "number"
        ? row.goal_amount_cents
        : typeof row.goal_amount_cents === "string"
          ? Number(row.goal_amount_cents)
          : null,
    currency: typeof row.currency === "string" ? row.currency : "usd",
    is_active: row.is_active !== false,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
    total_completed_cents: total.amount,
    intent_count: total.count,
    community: community ? { name: community.name || null, slug: community.slug || null } : undefined,
  };
}

function mapIntent(row: Record<string, unknown>): GivingIntent {
  const campaign = row.giving_campaigns as { title?: string } | null | undefined;
  const community = row.churches as { name?: string; slug?: string } | null | undefined;
  const status =
    row.status === "completed" || row.status === "failed" || row.status === "cancelled" || row.status === "pending"
      ? row.status
      : "draft";

  return {
    id: String(row.id),
    community_id: String(row.community_id),
    campaign_id: typeof row.campaign_id === "string" ? row.campaign_id : null,
    giver_id: typeof row.giver_id === "string" ? row.giver_id : null,
    amount_cents: typeof row.amount_cents === "number" ? row.amount_cents : Number(row.amount_cents || 0),
    currency: typeof row.currency === "string" ? row.currency : "usd",
    giver_name: typeof row.giver_name === "string" ? row.giver_name : null,
    giver_email: typeof row.giver_email === "string" ? row.giver_email : null,
    note: typeof row.note === "string" ? row.note : null,
    status,
    created_at: String(row.created_at),
    campaign_title: campaign?.title || null,
    community: community ? { name: community.name || null, slug: community.slug || null } : undefined,
  };
}

async function getCommunityForManager(communityId: string) {
  const { user, profile } = await getCurrentAuthAndProfile();
  await assertNotBanned(user.id);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("churches")
    .select("id,name,slug,created_by,is_published")
    .eq("id", communityId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { user, profile, community: null };
  }

  const community = mapCommunity(data as unknown as Record<string, unknown>);
  if (!(await canCreateEvent(communityId, { profile }))) {
    return { user, profile, community: null };
  }

  return { user, profile, community };
}

async function getCampaignTotals(campaignIds: string[]) {
  const totals = new Map<string, { amount: number; count: number }>();

  if (campaignIds.length === 0) {
    return totals;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("giving_intents")
    .select("campaign_id,amount_cents")
    .in("campaign_id", campaignIds)
    .eq("status", "completed");

  if (error) {
    if (error.code === "42P01") {
      return totals;
    }

    throw new Error(error.message);
  }

  for (const row of (data || []) as unknown as Record<string, unknown>[]) {
    const campaignId = typeof row.campaign_id === "string" ? row.campaign_id : "";
    if (!campaignId) {
      continue;
    }
    const amount = typeof row.amount_cents === "number" ? row.amount_cents : Number(row.amount_cents || 0);
    const current = totals.get(campaignId) || { amount: 0, count: 0 };
    current.amount += amount;
    current.count += 1;
    totals.set(campaignId, current);
  }

  return totals;
}

async function loadCampaigns(communityId: string, activeOnly: boolean) {
  const admin = createAdminClient();
  let query = admin
    .from("giving_campaigns")
    .select("id,community_id,created_by,title,description,goal_amount_cents,currency,is_active,created_at,updated_at,deleted_at,churches:community_id(name,slug)")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });

  if (activeOnly) {
    query = query.eq("is_active", true).is("deleted_at", null);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw new Error(error.message);
  }

  const rows = (data || []) as unknown as Record<string, unknown>[];
  const totals = await getCampaignTotals(rows.map((row) => String(row.id)));
  return rows.map((row) => mapCampaign(row, totals));
}

export async function getPublicGivingCampaigns(communityId: string) {
  return loadCampaigns(communityId, true);
}

export async function getPublicGivingCampaign(communityId: string, campaignId: string) {
  const campaigns = await loadCampaigns(communityId, true);
  return campaigns.find((campaign) => campaign.id === campaignId) || null;
}

export async function getGivingForLeader(communityId: string) {
  const access = await getCommunityForManager(communityId);

  if (!access.community) {
    return { community: null, campaigns: [] as GivingCampaign[], intents: [] as GivingIntent[] };
  }

  const admin = createAdminClient();
  const campaigns = await loadCampaigns(communityId, false);
  const { data, error } = await admin
    .from("giving_intents")
    .select("id,community_id,campaign_id,giver_id,amount_cents,currency,giver_name,giver_email,note,status,created_at,giving_campaigns:campaign_id(title)")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error && error.code !== "42P01") {
    throw new Error(error.message);
  }

  return {
    community: access.community,
    campaigns,
    intents: ((data || []) as unknown as Record<string, unknown>[]).map(mapIntent),
  };
}

export async function getGivingCampaignForLeader(communityId: string, campaignId: string) {
  const data = await getGivingForLeader(communityId);
  return {
    community: data.community,
    campaign: data.campaigns.find((campaign) => campaign.id === campaignId) || null,
  };
}

function validateCampaign(returnTo: string, title: string, description: string | null, goalAmountCents: number | null) {
  if (!title) {
    redirect(`${returnTo}?message=Campaign title is required.`);
  }

  if (title.length > MAX_TITLE_LENGTH) {
    redirect(`${returnTo}?message=Campaign title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
  }

  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    redirect(`${returnTo}?message=Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }

  if (goalAmountCents !== null && goalAmountCents <= 0) {
    redirect(`${returnTo}?message=Goal amount must be positive.`);
  }
}

export async function createGivingCampaign(formData: FormData) {
  const communityId = getFormString(formData, "community_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/leader/communities/${communityId}/giving`);
  const title = getFormString(formData, "title");
  const description = nullableFormString(formData, "description");
  const goalRaw = nullableFormString(formData, "goal_amount");
  const goalAmountCents = goalRaw ? parseDollarAmountToCents(goalRaw) : null;

  if (!communityId) {
    redirect("/leader?message=Community not found.");
  }

  validateCampaign(returnTo, title, description, goalAmountCents);

  const { user, community } = await getCommunityForManager(communityId);

  if (!community) {
    redirect("/leader?message=Only platform engineers can manage legacy giving campaigns right now.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("giving_campaigns").insert({
    community_id: communityId,
    created_by: user.id,
    title,
    description,
    goal_amount_cents: goalAmountCents,
    currency: "usd",
    is_active: formData.get("is_active") === "on",
  });

  if (error) {
    redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/leader/communities/${communityId}/giving`);
  revalidatePath(`/c/${community.slug}`);
  revalidatePath(`/c/${community.slug}/give`);
  redirect(returnTo);
}

export async function updateGivingCampaign(formData: FormData) {
  const campaignId = getFormString(formData, "campaign_id");
  const communityId = getFormString(formData, "community_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/leader/communities/${communityId}/giving`);
  const title = getFormString(formData, "title");
  const description = nullableFormString(formData, "description");
  const goalRaw = nullableFormString(formData, "goal_amount");
  const goalAmountCents = goalRaw ? parseDollarAmountToCents(goalRaw) : null;

  if (!campaignId || !communityId) {
    redirect(`${returnTo}?message=Campaign not found.`);
  }

  validateCampaign(returnTo, title, description, goalAmountCents);

  const { community } = await getCommunityForManager(communityId);

  if (!community) {
    redirect("/leader?message=Only platform engineers can manage legacy giving campaigns right now.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("giving_campaigns")
    .update({
      title,
      description,
      goal_amount_cents: goalAmountCents,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", campaignId)
    .eq("community_id", communityId);

  if (error) {
    redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/leader/communities/${communityId}/giving`);
  revalidatePath(`/leader/communities/${communityId}/giving/${campaignId}/edit`);
  revalidatePath(`/c/${community.slug}`);
  revalidatePath(`/c/${community.slug}/give`);
  redirect(returnTo);
}

export async function deactivateGivingCampaign(formData: FormData) {
  const campaignId = getFormString(formData, "campaign_id");
  const communityId = getFormString(formData, "community_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), communityId ? `/leader/communities/${communityId}/giving` : "/platform");
  const confirmation = getFormString(formData, "confirmation");

  if (!campaignId) {
    redirect(`${returnTo}?message=Campaign not found.`);
  }

  if (confirmation !== "DELETE") {
    redirect(`${returnTo}?message=Type DELETE to deactivate this campaign.`);
  }

  const admin = createAdminClient();
  let slug: string | null = null;

  if (communityId) {
    const { community } = await getCommunityForManager(communityId);
    if (!community) {
      redirect("/leader?message=Only platform engineers can manage legacy giving campaigns right now.");
    }
    slug = community.slug;
  } else {
    await requirePlatformEngineer();
  }

  const { error } = await admin
    .from("giving_campaigns")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", campaignId);

  if (error) {
    redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  }

  if (communityId) {
    revalidatePath(`/leader/communities/${communityId}/giving`);
  }
  if (slug) {
    revalidatePath(`/c/${slug}`);
    revalidatePath(`/c/${slug}/give`);
  }
  revalidatePath("/platform");
  redirect(returnTo);
}

export async function createGivingIntent(formData: FormData) {
  const communityId = getFormString(formData, "community_id");
  const campaignId = nullableFormString(formData, "campaign_id");
  const slug = getFormString(formData, "slug");
  const returnTo = safeReturnPath(
    getFormString(formData, "return_to"),
    campaignId && slug ? `/c/${slug}/give/${campaignId}` : slug ? `/c/${slug}/give` : "/discover",
  );
  const amountCents = parseDollarAmountToCents(getFormString(formData, "amount"));
  const note = nullableFormString(formData, "note");

  if (!communityId || !slug) {
    redirect("/discover");
  }

  if (!amountCents || amountCents < MIN_GIFT_CENTS) {
    redirect(`${returnTo}?message=Donation amount must be at least $1.`);
  }

  if (note && note.length > MAX_NOTE_LENGTH) {
    redirect(`${returnTo}?message=Note must be ${MAX_NOTE_LENGTH} characters or fewer.`);
  }

  const auth = await getOptionalAuthAndProfile();
  if (auth) {
    await assertNotBanned(auth.user.id);
  }

  const admin = createAdminClient();
  const { data: community, error: communityError } = await admin
    .from("churches")
    .select("id,is_published")
    .eq("id", communityId)
    .eq("is_published", true)
    .maybeSingle();

  if (communityError) {
    throw new Error(communityError.message);
  }

  if (!community) {
    redirect("/discover?message=Community not found.");
  }

  if (campaignId) {
    const { data: campaign, error: campaignError } = await admin
      .from("giving_campaigns")
      .select("id")
      .eq("id", campaignId)
      .eq("community_id", communityId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (campaignError) {
      throw new Error(campaignError.message);
    }

    if (!campaign) {
      redirect(`/c/${slug}/give?message=Giving campaign is not available.`);
    }
  }

  const { error } = await admin.from("giving_intents").insert({
    community_id: communityId,
    campaign_id: campaignId,
    giver_id: auth?.user.id || null,
    amount_cents: amountCents,
    currency: "usd",
    giver_name: nullableFormString(formData, "giver_name"),
    giver_email: nullableFormString(formData, "giver_email"),
    note,
    status: "pending",
  });

  if (error) {
    redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?message=Giving is being prepared. Online payments are not live yet.`);
}

export async function getPlatformGivingData() {
  await requirePlatformEngineer();
  const admin = createAdminClient();
  const [campaignsResult, intentsResult] = await Promise.all([
    admin
      .from("giving_campaigns")
      .select("id,community_id,created_by,title,description,goal_amount_cents,currency,is_active,created_at,updated_at,deleted_at,churches:community_id(name,slug)")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("giving_intents")
      .select("id,community_id,campaign_id,giver_id,amount_cents,currency,giver_name,giver_email,note,status,created_at,giving_campaigns:campaign_id(title),churches:community_id(name,slug)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (campaignsResult.error && campaignsResult.error.code !== "42P01") {
    throw new Error(campaignsResult.error.message);
  }

  if (intentsResult.error && intentsResult.error.code !== "42P01") {
    throw new Error(intentsResult.error.message);
  }

  const campaignRows = (campaignsResult.data || []) as unknown as Record<string, unknown>[];
  const totals = await getCampaignTotals(campaignRows.map((row) => String(row.id)));

  return {
    campaigns: campaignRows.map((row) => mapCampaign(row, totals)),
    intents: ((intentsResult.data || []) as unknown as Record<string, unknown>[]).map(mapIntent),
  };
}
