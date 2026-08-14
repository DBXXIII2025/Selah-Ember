"use server";

import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuthAndProfile, getOptionalAuthAndProfile } from "@/lib/auth/current";
import { assertNotBanned, getActiveBanForUser } from "@/lib/moderation/bans";
import { getDisplayProfiles } from "@/lib/profiles/display";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBibleBook,
  getBibleTranslations,
  getBibleVerseHref,
  loadBibleChapter,
  normalizeBookId,
  normalizeChapter,
  normalizeTranslationId,
} from "@/lib/bible/data";
import type { CommunityPost } from "@/app/actions/community-posts";

const MAX_TESTIMONY_TITLE = 160;
const MAX_TESTIMONY_SECTION = 4000;
const MAX_SCRIPTURE_REFLECTION = 2000;
const MAX_REPORT_REASON = 160;
const MAX_REPORT_DETAILS = 1000;
const MAX_TOPIC_NAME = 120;
const MAX_TOPIC_DESCRIPTION = 500;
const MIN_TOPIC_SORT_ORDER = -100000;
const MAX_TOPIC_SORT_ORDER = 100000;
const DEFAULT_TRANSLATION_ID = getBibleTranslations()[0]?.id || "web";

export type CommunityTopic = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_sensitive: boolean;
  is_active: boolean;
};

export type TopicScripture = {
  translationId: string;
  bookId: string;
  chapter: number;
  verseStart: string;
  verseEnd?: string;
  label: string;
  href: string;
};

export type TestimonyScripture = TopicScripture & {
  id: string;
};

export type CommunityTestimony = {
  id: string;
  topic_id: string;
  topic_slug: string | null;
  topic_name: string | null;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  title: string;
  what_i_went_through: string;
  what_happened: string | null;
  what_god_taught_me: string | null;
  where_i_am_now: string | null;
  scripture_reflection: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  encouragement_count: number;
  viewer_encouraged: boolean;
  can_edit: boolean;
  scriptures: TestimonyScripture[];
};

export type CommunityTestimonyReport = {
  id: string;
  testimony_id: string;
  testimony_title: string;
  topic_name: string | null;
  reason: string;
  details: string | null;
  status: "open" | "reviewed" | "resolved" | "dismissed";
  created_at: string;
  reporter_label: string;
  author_label: string;
};

const topicDescriptions: Record<string, string> = {
  anger: "Conversations for surrendering anger, pursuing patience, and responding with grace.",
  depression: "Encouragement for heavy seasons and honest conversation in Christian community.",
  "anxiety-fear": "Scripture and support for fear, anxious thoughts, and learning to trust God.",
  sadness: "A quiet space for sorrow, discouragement, and hope.",
  grief: "Care for loss, mourning, remembrance, and comfort.",
  loneliness: "Community for isolation, friendship, belonging, and being seen.",
  ptsd: "Personal stories and support for hard memories and trauma-affected seasons.",
  "postpartum-depression-ppd": "Supportive Christian community for postpartum depression experiences.",
  relationships: "Wisdom and prayer for friendships, dating, marriage, and conflict.",
  forgiveness:
    "Support for struggling to forgive after hurt, resentment, bitterness, reconciliation questions, boundaries, healing, and seeking biblical guidance without staying in unsafe circumstances.",
  temptation: "Support for resisting temptation and walking in repentance.",
  "faith-doubt": "Honest questions, assurance, and learning to keep seeking Christ.",
  purpose: "Conversation about calling, work, gifts, and faithful next steps.",
  family: "Support for family strain, parenting, home life, and reconciliation.",
  "financial-struggles": "Prayer and encouragement for provision, pressure, and stewardship.",
  "spiritual-growth": "Daily discipleship, practices, maturity, and abiding in Christ.",
};

const curatedScriptures: Record<string, Array<Omit<TopicScripture, "label" | "href">>> = {
  anger: [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "JAS", chapter: 1, verseStart: "19", verseEnd: "20" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "EPH", chapter: 4, verseStart: "26" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "PRO", chapter: 15, verseStart: "1" },
  ],
  depression: [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "PSA", chapter: 34, verseStart: "18" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "MAT", chapter: 11, verseStart: "28" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "ROM", chapter: 8, verseStart: "38", verseEnd: "39" },
  ],
  "anxiety-fear": [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "PHP", chapter: 4, verseStart: "6", verseEnd: "7" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "ISA", chapter: 41, verseStart: "10" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "1PE", chapter: 5, verseStart: "7" },
  ],
  sadness: [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "PSA", chapter: 42, verseStart: "11" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "JHN", chapter: 16, verseStart: "33" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "REV", chapter: 21, verseStart: "4" },
  ],
  grief: [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "MAT", chapter: 5, verseStart: "4" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "2CO", chapter: 1, verseStart: "3", verseEnd: "4" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "1TH", chapter: 4, verseStart: "13" },
  ],
  loneliness: [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "PSA", chapter: 68, verseStart: "6" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "HEB", chapter: 13, verseStart: "5" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "JHN", chapter: 14, verseStart: "18" },
  ],
  ptsd: [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "PSA", chapter: 23, verseStart: "4" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "PSA", chapter: 46, verseStart: "1" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "2TI", chapter: 1, verseStart: "7" },
  ],
  "postpartum-depression-ppd": [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "ISA", chapter: 40, verseStart: "11" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "PSA", chapter: 61, verseStart: "2" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "MAT", chapter: 11, verseStart: "28" },
  ],
  relationships: [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "ROM", chapter: 12, verseStart: "18" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "COL", chapter: 3, verseStart: "13" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "1CO", chapter: 13, verseStart: "4", verseEnd: "7" },
  ],
  forgiveness: [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "EPH", chapter: 4, verseStart: "32" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "MAT", chapter: 6, verseStart: "14" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "COL", chapter: 3, verseStart: "13" },
  ],
  temptation: [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "1CO", chapter: 10, verseStart: "13" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "JAS", chapter: 4, verseStart: "7" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "HEB", chapter: 4, verseStart: "15", verseEnd: "16" },
  ],
  "faith-doubt": [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "MRK", chapter: 9, verseStart: "24" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "HEB", chapter: 11, verseStart: "1" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "JAS", chapter: 1, verseStart: "5" },
  ],
  purpose: [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "EPH", chapter: 2, verseStart: "10" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "COL", chapter: 3, verseStart: "23" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "PRO", chapter: 3, verseStart: "5", verseEnd: "6" },
  ],
  family: [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "JOS", chapter: 24, verseStart: "15" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "EPH", chapter: 6, verseStart: "1", verseEnd: "4" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "COL", chapter: 3, verseStart: "12", verseEnd: "14" },
  ],
  "financial-struggles": [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "MAT", chapter: 6, verseStart: "31", verseEnd: "33" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "PHP", chapter: 4, verseStart: "19" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "HEB", chapter: 13, verseStart: "5" },
  ],
  "spiritual-growth": [
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "JHN", chapter: 15, verseStart: "5" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "GAL", chapter: 5, verseStart: "22", verseEnd: "23" },
    { translationId: DEFAULT_TRANSLATION_ID, bookId: "2PE", chapter: 3, verseStart: "18" },
  ],
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

function normalizeTopicSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

function getCheckboxBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function parseTopicSortOrder(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

async function generateUniqueTopicSlug(admin: ReturnType<typeof createAdminClient>, name: string) {
  const baseSlug = normalizeTopicSlug(name);
  if (!baseSlug) return "";

  for (let index = 0; index < 100; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const candidate = `${baseSlug.slice(0, 80 - suffix.length)}${suffix}`;
    const { data, error } = await admin
      .from("community_topics")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return candidate;
    }
  }

  throw new Error("Could not create a unique topic slug.");
}

function mapTopic(row: Record<string, unknown>): CommunityTopic {
  const slug = String(row.slug);
  const storedName = String(row.name);
  return {
    id: String(row.id),
    slug,
    name: slug === "forgiveness" && storedName === "Forgiveness" ? "Unforgiveness" : storedName,
    description: typeof row.description === "string" ? row.description : topicDescriptions[slug] || null,
    sort_order: Number(row.sort_order || 0),
    is_sensitive: row.is_sensitive === true,
    is_active: row.is_active !== false,
  };
}

function scriptureLabel(reference: Omit<TopicScripture, "label" | "href">) {
  const book = getBibleBook(reference.bookId);
  const verse = reference.verseEnd && reference.verseEnd !== reference.verseStart
    ? `${reference.verseStart}-${reference.verseEnd}`
    : reference.verseStart;
  return `${book.name} ${reference.chapter}:${verse}`;
}

function enrichScripture(reference: Omit<TopicScripture, "label" | "href">): TopicScripture {
  return {
    ...reference,
    label: scriptureLabel(reference),
    href: getBibleVerseHref({
      translationId: reference.translationId,
      bookId: reference.bookId,
      chapter: reference.chapter,
      verse: reference.verseStart,
    }),
  };
}

export async function getCuratedTopicScriptures(slug: string): Promise<TopicScripture[]> {
  return (curatedScriptures[slug] || curatedScriptures["spiritual-growth"] || []).map(enrichScripture);
}

export async function getCommunityTopics() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("community_topics")
    .select("id,slug,name,description,sort_order,is_sensitive,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return [];
  }

  return ((data || []) as unknown as Record<string, unknown>[]).map(mapTopic);
}

export async function getCommunityTopicsForPlatform() {
  const { requirePlatformEngineer } = await import("@/lib/platform/auth");
  await requirePlatformEngineer();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("community_topics")
    .select("id,slug,name,description,sort_order,is_sensitive,is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as unknown as Record<string, unknown>[]).map(mapTopic);
}

export async function saveCommunityTopic(formData: FormData) {
  const { requirePlatformEngineer } = await import("@/lib/platform/auth");
  await requirePlatformEngineer();

  const topicId = getFormString(formData, "topic_id");
  const name = getFormString(formData, "name");
  const description = nullableFormString(formData, "description");
  const sortOrder = parseTopicSortOrder(getFormString(formData, "sort_order"));
  const isSensitive = getCheckboxBoolean(formData, "is_sensitive");
  const isActive = getCheckboxBoolean(formData, "is_active");

  if (!name) {
    redirect("/platform?message=Topic name is required.");
  }

  if (name.length > MAX_TOPIC_NAME) {
    redirect(`/platform?message=Topic name must be ${MAX_TOPIC_NAME} characters or fewer.`);
  }

  if (description && description.length > MAX_TOPIC_DESCRIPTION) {
    redirect(`/platform?message=Topic description must be ${MAX_TOPIC_DESCRIPTION} characters or fewer.`);
  }

  if (!Number.isInteger(sortOrder) || sortOrder < MIN_TOPIC_SORT_ORDER || sortOrder > MAX_TOPIC_SORT_ORDER) {
    redirect("/platform?message=Topic sort order must be a whole number between -100000 and 100000.");
  }

  const admin = createAdminClient();

  if (topicId) {
    const { data: existing, error: existingError } = await admin
      .from("community_topics")
      .select("id,slug")
      .eq("id", topicId)
      .maybeSingle();

    if (existingError) {
      redirect(`/platform?message=${encodeURIComponent(existingError.message)}`);
    }

    if (!existing) {
      redirect("/platform?message=Topic not found.");
    }

    const { error } = await admin
      .from("community_topics")
      .update({
        name,
        description,
        sort_order: sortOrder,
        is_sensitive: isSensitive,
        is_active: isActive,
      })
      .eq("id", topicId);

    if (error) {
      redirect(`/platform?message=${encodeURIComponent(error.message)}`);
    }

    const slug = typeof existing.slug === "string" ? existing.slug : "";
    revalidatePath("/platform");
    revalidatePath("/community");
    revalidatePath("/community/topics");
    if (slug) revalidatePath(`/community/topics/${slug}`);
    redirect("/platform?message=Community topic updated.");
  }

  let slug = "";
  try {
    slug = await generateUniqueTopicSlug(admin, name);
  } catch (error) {
    redirect(`/platform?message=${encodeURIComponent(error instanceof Error ? error.message : "Could not create a unique topic slug.")}`);
  }
  if (!slug) {
    redirect("/platform?message=Topic name must produce a valid slug.");
  }

  const { error } = await admin.from("community_topics").insert({
    slug,
    name,
    description,
    sort_order: sortOrder,
    is_sensitive: isSensitive,
    is_active: isActive,
  });

  if (error) {
    redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/platform");
  revalidatePath("/community");
  revalidatePath("/community/topics");
  redirect("/platform?message=Community topic created.");
}

export async function getCommunityTopicBySlug(slug: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("community_topics")
    .select("id,slug,name,description,sort_order,is_sensitive,is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data ? mapTopic(data as unknown as Record<string, unknown>) : null;
}

function mapPost(row: Record<string, unknown>): CommunityPost {
  const mediaKind =
    row.media_kind === "image" || row.media_kind === "video" || row.media_kind === "link" ? row.media_kind : null;
  return {
    id: String(row.id),
    community_id: String(row.community_id),
    author_id: typeof row.author_id === "string" ? row.author_id : "",
    title: typeof row.title === "string" ? row.title : null,
    body: typeof row.body === "string" ? row.body : null,
    media_url: typeof row.media_url === "string" ? row.media_url : null,
    media_kind: mediaKind,
    storage_path: typeof row.storage_path === "string" ? row.storage_path : null,
    file_name: typeof row.file_name === "string" ? row.file_name : null,
    mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
    size_bytes: typeof row.size_bytes === "number" ? row.size_bytes : typeof row.size_bytes === "string" ? Number(row.size_bytes) : null,
    is_published: row.is_published !== false,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
    signed_url: null,
    author_name: null,
    author_avatar_url: null,
    comment_count: 0,
    reaction_counts: { like: 0, pray: 0, fire: 0, laugh: 0 },
    viewer_reactions: [],
    can_delete: false,
    can_edit: false,
  };
}

export async function getTopicCommunityPosts(topicId: string): Promise<CommunityPost[]> {
  const auth = await getOptionalAuthAndProfile();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("community_post_topics")
    .select("community_posts:post_id(id,community_id,author_id,title,body,media_url,media_kind,storage_path,file_name,mime_type,size_bytes,is_published,created_at,updated_at,deleted_at)")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return [];
  }

  const posts = ((data || []) as unknown as Record<string, unknown>[])
    .map((row) => row.community_posts as Record<string, unknown> | null)
    .filter((post): post is Record<string, unknown> => Boolean(post && !post.deleted_at && post.is_published !== false))
    .map(mapPost);
  const profiles = await getDisplayProfiles(posts.map((post) => post.author_id));
  const currentUserId = auth?.user.id || null;
  const canModerate = auth?.profile.role === "platform_engineer";

  return posts.map((post) => {
    const profile = profiles.get(post.author_id);
    return {
      ...post,
      author_name: post.author_id ? profile?.display_name || "Member" : "Deleted user",
      author_avatar_url: profile?.avatar_url || null,
      can_delete: canModerate || Boolean(currentUserId && post.author_id === currentUserId),
      can_edit: canModerate || Boolean(currentUserId && post.author_id === currentUserId),
    };
  });
}

async function validateScriptureReference(input: {
  translationId: string;
  bookId: string;
  chapter: number;
  verseStart: string | null;
  verseEnd: string | null;
}) {
  const translationId = normalizeTranslationId(input.translationId);
  const bookId = normalizeBookId(input.bookId);
  const chapterNumber = normalizeChapter(translationId, bookId, input.chapter);
  const chapter = await loadBibleChapter(translationId, bookId, chapterNumber);
  const verses = new Set(chapter.verses.map((verse) => verse.number));
  const verseStart = input.verseStart || null;
  const verseEnd = input.verseEnd || null;

  if (input.chapter !== chapterNumber) {
    throw new Error("Choose a valid Bible chapter.");
  }

  if (!verseStart) {
    throw new Error("Choose a valid Bible verse.");
  }

  if (verseStart && !verses.has(verseStart)) {
    throw new Error("Choose a valid starting verse.");
  }

  if (verseEnd && !verses.has(verseEnd)) {
    throw new Error("Choose a valid ending verse.");
  }

  return { translationId, bookId, chapter: chapterNumber, verseStart, verseEnd };
}

function validateTestimonyInput(returnTo: string, input: {
  title: string;
  whatWentThrough: string;
  whatHappened: string | null;
  whatGodTaught: string | null;
  whereNow: string | null;
  scriptureReflection: string | null;
}) {
  if (!input.title) redirect(`${returnTo}?message=Title is required.`);
  if (input.title.length > MAX_TESTIMONY_TITLE) redirect(`${returnTo}?message=Title must be ${MAX_TESTIMONY_TITLE} characters or fewer.`);
  if (!input.whatWentThrough) redirect(`${returnTo}?message=Share what you went through.`);
  if (input.whatWentThrough.length > MAX_TESTIMONY_SECTION) redirect(`${returnTo}?message=Each testimony section must be ${MAX_TESTIMONY_SECTION} characters or fewer.`);
  for (const value of [input.whatHappened, input.whatGodTaught, input.whereNow]) {
    if (value && value.length > MAX_TESTIMONY_SECTION) redirect(`${returnTo}?message=Each testimony section must be ${MAX_TESTIMONY_SECTION} characters or fewer.`);
  }
  if (input.scriptureReflection && input.scriptureReflection.length > MAX_SCRIPTURE_REFLECTION) {
    redirect(`${returnTo}?message=Scripture reflection must be ${MAX_SCRIPTURE_REFLECTION} characters or fewer.`);
  }
  if (!input.whatHappened && !input.whatGodTaught && !input.whereNow) {
    redirect(`${returnTo}?message=Add at least one reflection field.`);
  }
}

async function replaceTestimonyScriptures(testimonyId: string, formData: FormData, returnTo: string) {
  const translationId = getFormString(formData, "translation_id");
  const bookId = getFormString(formData, "book_id");
  const chapter = Number.parseInt(getFormString(formData, "chapter"), 10);
  const verseStart = nullableFormString(formData, "verse_start");
  const verseEnd = nullableFormString(formData, "verse_end");
  let reference: Awaited<ReturnType<typeof validateScriptureReference>>;

  try {
    reference = await validateScriptureReference({ translationId, bookId, chapter, verseStart, verseEnd });
  } catch (error) {
    redirect(`${returnTo}?message=${encodeURIComponent(error instanceof Error ? error.message : "Choose a valid Bible reference.")}`);
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin.from("community_testimony_scriptures").delete().eq("testimony_id", testimonyId);
  if (deleteError) redirect(`${returnTo}?message=${encodeURIComponent(deleteError.message)}`);

  const { error } = await admin.from("community_testimony_scriptures").insert({
    testimony_id: testimonyId,
    translation_id: reference.translationId,
    book_id: reference.bookId,
    chapter: reference.chapter,
    verse_start: reference.verseStart,
    verse_end: reference.verseEnd,
  });
  if (error) redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
}

export async function createCommunityTestimony(formData: FormData) {
  const topicSlug = getFormString(formData, "topic_slug");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), topicSlug ? `/community/topics/${topicSlug}/testimonies/new` : "/community/testimonies/new");
  const topic = await getCommunityTopicBySlug(topicSlug);
  if (!topic) redirect(`${returnTo}?message=Choose a valid topic.`);

  const input = {
    title: getFormString(formData, "title"),
    whatWentThrough: getFormString(formData, "what_i_went_through"),
    whatHappened: nullableFormString(formData, "what_happened"),
    whatGodTaught: nullableFormString(formData, "what_god_taught_me"),
    whereNow: nullableFormString(formData, "where_i_am_now"),
    scriptureReflection: nullableFormString(formData, "scripture_reflection"),
  };
  validateTestimonyInput(returnTo, input);

  const { user } = await getCurrentAuthAndProfile();
  await assertNotBanned(user.id, `${returnTo}?message=Your account cannot share testimony right now.`);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("community_testimonies")
    .insert({
      topic_id: topic.id,
      author_id: user.id,
      title: input.title,
      what_i_went_through: input.whatWentThrough,
      what_happened: input.whatHappened,
      what_god_taught_me: input.whatGodTaught,
      where_i_am_now: input.whereNow,
      scripture_reflection: input.scriptureReflection,
      is_published: true,
    })
    .select("id")
    .single();

  if (error) redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  await replaceTestimonyScriptures(String(data.id), formData, returnTo);
  revalidatePath("/community");
  revalidatePath("/community/testimonies");
  revalidatePath(`/community/topics/${topic.slug}`);
  redirect(`/community/testimonies/${data.id}`);
}

async function getTestimonyRecord(testimonyId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("community_testimonies")
    .select("id,topic_id,author_id,title,what_i_went_through,what_happened,what_god_taught_me,where_i_am_now,scripture_reflection,is_published,created_at,updated_at,deleted_at,community_topics:topic_id(slug,name)")
    .eq("id", testimonyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

export async function updateCommunityTestimony(formData: FormData) {
  const testimonyId = getFormString(formData, "testimony_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), testimonyId ? `/community/testimonies/${testimonyId}/edit` : "/community/testimonies");
  const record = testimonyId ? await getTestimonyRecord(testimonyId) : null;
  if (!record) redirect(`${returnTo}?message=Testimony not found.`);
  const { user, profile } = await getCurrentAuthAndProfile();
  await assertNotBanned(user.id, `${returnTo}?message=Your account cannot edit testimony right now.`);
  if (record.deleted_at || record.is_published === false) {
    redirect(`${returnTo}?message=Testimony not found.`);
  }
  if (profile.role !== "platform_engineer" && record.author_id !== user.id) {
    redirect(`${returnTo}?message=You can only edit your own testimony.`);
  }

  const input = {
    title: getFormString(formData, "title"),
    whatWentThrough: getFormString(formData, "what_i_went_through"),
    whatHappened: nullableFormString(formData, "what_happened"),
    whatGodTaught: nullableFormString(formData, "what_god_taught_me"),
    whereNow: nullableFormString(formData, "where_i_am_now"),
    scriptureReflection: nullableFormString(formData, "scripture_reflection"),
  };
  validateTestimonyInput(returnTo, input);

  const admin = createAdminClient();
  let updateQuery = admin
    .from("community_testimonies")
    .update({
      title: input.title,
      what_i_went_through: input.whatWentThrough,
      what_happened: input.whatHappened,
      what_god_taught_me: input.whatGodTaught,
      where_i_am_now: input.whereNow,
      scripture_reflection: input.scriptureReflection,
    })
    .eq("id", testimonyId)
    .eq("is_published", true)
    .is("deleted_at", null);

  if (profile.role !== "platform_engineer") {
    updateQuery = updateQuery.eq("author_id", user.id);
  }

  const { data: updated, error } = await updateQuery.select("id").maybeSingle();
  if (error) redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  if (!updated) redirect(`${returnTo}?message=Testimony update was not authorized.`);
  await replaceTestimonyScriptures(testimonyId, formData, returnTo);
  revalidatePath("/community/testimonies");
  revalidatePath(`/community/testimonies/${testimonyId}`);
  redirect(`/community/testimonies/${testimonyId}`);
}

export async function deleteCommunityTestimony(formData: FormData) {
  const testimonyId = getFormString(formData, "testimony_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), "/community/testimonies");
  if (!testimonyId) redirect(`${returnTo}?message=Testimony not found.`);
  const { user, profile } = await getCurrentAuthAndProfile();
  const admin = createAdminClient();
  let query = admin
    .from("community_testimonies")
    .update({
      title: "Deleted testimony",
      what_i_went_through: "Deleted testimony",
      what_happened: "Deleted testimony",
      what_god_taught_me: null,
      where_i_am_now: null,
      scripture_reflection: null,
      is_published: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", testimonyId);
  if (profile.role !== "platform_engineer") query = query.eq("author_id", user.id);
  const { error } = await query;
  if (error) redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  revalidatePath("/community/testimonies");
  redirect(`${returnTo}?message=Testimony deleted.`);
}

function mapScripture(row: Record<string, unknown>): TestimonyScripture {
  const reference = enrichScripture({
    translationId: String(row.translation_id),
    bookId: String(row.book_id),
    chapter: Number(row.chapter),
    verseStart: typeof row.verse_start === "string" ? row.verse_start : "",
    verseEnd: typeof row.verse_end === "string" ? row.verse_end : undefined,
  });
  return { id: String(row.id), ...reference };
}

async function hydrateTestimonies(rows: Record<string, unknown>[]): Promise<CommunityTestimony[]> {
  const auth = await getOptionalAuthAndProfile();
  const currentUserId = auth?.user.id || null;
  const canModerate = auth?.profile.role === "platform_engineer";
  const ids = rows.map((row) => String(row.id));
  const authorIds = rows.map((row) => (typeof row.author_id === "string" ? row.author_id : null)).filter((id): id is string => Boolean(id));
  const admin = createAdminClient();
  const [profiles, scripturesResult, encouragementsResult] = await Promise.all([
    getDisplayProfiles(authorIds),
    ids.length
      ? admin.from("community_testimony_scriptures").select("id,testimony_id,translation_id,book_id,chapter,verse_start,verse_end").in("testimony_id", ids).order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? admin.from("community_testimony_encouragements").select("testimony_id,author_id").in("testimony_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (scripturesResult.error) throw new Error(scripturesResult.error.message);
  if (encouragementsResult.error) throw new Error(encouragementsResult.error.message);
  const scriptureMap = new Map<string, TestimonyScripture[]>();
  for (const row of (scripturesResult.data || []) as unknown as Record<string, unknown>[]) {
    const testimonyId = String(row.testimony_id);
    scriptureMap.set(testimonyId, [...(scriptureMap.get(testimonyId) || []), mapScripture(row)]);
  }
  const encouragementCounts = new Map<string, number>();
  const viewerEncouraged = new Set<string>();
  for (const row of (encouragementsResult.data || []) as unknown as Record<string, unknown>[]) {
    const testimonyId = String(row.testimony_id);
    encouragementCounts.set(testimonyId, (encouragementCounts.get(testimonyId) || 0) + 1);
    if (currentUserId && row.author_id === currentUserId) viewerEncouraged.add(testimonyId);
  }

  return rows.map((row) => {
    const authorId = typeof row.author_id === "string" ? row.author_id : null;
    const profile = authorId ? profiles.get(authorId) : null;
    const topic = row.community_topics as Record<string, unknown> | null | undefined;
    const id = String(row.id);
    return {
      id,
      topic_id: String(row.topic_id),
      topic_slug: typeof topic?.slug === "string" ? topic.slug : null,
      topic_name: typeof topic?.name === "string" ? topic.name : null,
      author_id: authorId,
      author_name: authorId ? profile?.display_name || "Member" : "Deleted user",
      author_avatar_url: profile?.avatar_url || null,
      title: String(row.title),
      what_i_went_through: String(row.what_i_went_through),
      what_happened: typeof row.what_happened === "string" ? row.what_happened : null,
      what_god_taught_me: typeof row.what_god_taught_me === "string" ? row.what_god_taught_me : null,
      where_i_am_now: typeof row.where_i_am_now === "string" ? row.where_i_am_now : null,
      scripture_reflection: typeof row.scripture_reflection === "string" ? row.scripture_reflection : null,
      is_published: row.is_published !== false,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
      encouragement_count: encouragementCounts.get(id) || 0,
      viewer_encouraged: viewerEncouraged.has(id),
      can_edit: canModerate || Boolean(currentUserId && authorId === currentUserId),
      scriptures: scriptureMap.get(id) || [],
    };
  });
}

export async function getCommunityTestimonies(topicSlug?: string | null) {
  noStore();
  const admin = createAdminClient();
  let query = admin
    .from("community_testimonies")
    .select("id,topic_id,author_id,title,what_i_went_through,what_happened,what_god_taught_me,where_i_am_now,scripture_reflection,is_published,created_at,updated_at,deleted_at,community_topics:topic_id(slug,name)")
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (topicSlug) {
    const topic = await getCommunityTopicBySlug(topicSlug);
    if (!topic) return [];
    query = query.eq("topic_id", topic.id);
  }
  const { data, error } = await query;
  if (error) {
    return [];
  }
  return hydrateTestimonies((data || []) as unknown as Record<string, unknown>[]);
}

export async function getCommunityTestimony(testimonyId: string) {
  noStore();
  const row = await getTestimonyRecord(testimonyId);
  if (!row || row.deleted_at || row.is_published === false) return null;
  const [testimony] = await hydrateTestimonies([row]);
  return testimony || null;
}

export async function toggleTestimonyEncouragement(formData: FormData) {
  const testimonyId = getFormString(formData, "testimony_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), testimonyId ? `/community/testimonies/${testimonyId}` : "/community/testimonies");
  if (!testimonyId) redirect(`${returnTo}?message=Testimony not found.`);
  const { user } = await getCurrentAuthAndProfile();
  await assertNotBanned(user.id, `${returnTo}?message=Your account cannot encourage testimony right now.`);
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("community_testimony_encouragements")
    .select("testimony_id")
    .eq("testimony_id", testimonyId)
    .eq("author_id", user.id)
    .maybeSingle();
  if (existingError) redirect(`${returnTo}?message=${encodeURIComponent(existingError.message)}`);
  const { error } = existing
    ? await admin.from("community_testimony_encouragements").delete().eq("testimony_id", testimonyId).eq("author_id", user.id)
    : await admin.from("community_testimony_encouragements").insert({ testimony_id: testimonyId, author_id: user.id });
  if (error) redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  revalidatePath(returnTo);
  revalidatePath("/community/testimonies");
  redirect(returnTo);
}

export async function toggleTestimonyEncouragementState(input: { testimonyId: string; returnTo?: string }) {
  const returnTo = safeReturnPath(
    input.returnTo || "",
    input.testimonyId ? `/community/testimonies/${input.testimonyId}` : "/community/testimonies",
  );

  if (!input.testimonyId) return { ok: false, message: "Testimony not found." };

  const { user } = await getCurrentAuthAndProfile();
  if (await getActiveBanForUser(user.id)) {
    return { ok: false, message: "Your account cannot encourage testimony right now." };
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("community_testimony_encouragements")
    .select("testimony_id")
    .eq("testimony_id", input.testimonyId)
    .eq("author_id", user.id)
    .maybeSingle();

  if (existingError) return { ok: false, message: existingError.message };

  const { error } = existing
    ? await admin.from("community_testimony_encouragements").delete().eq("testimony_id", input.testimonyId).eq("author_id", user.id)
    : await admin.from("community_testimony_encouragements").insert({ testimony_id: input.testimonyId, author_id: user.id });

  if (error) return { ok: false, message: error.message };

  revalidatePath(returnTo);
  revalidatePath("/community/testimonies");
  return { ok: true };
}

export async function reportCommunityTestimony(formData: FormData) {
  const testimonyId = getFormString(formData, "testimony_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), testimonyId ? `/community/testimonies/${testimonyId}` : "/community/testimonies");
  const reason = getFormString(formData, "reason");
  const details = nullableFormString(formData, "details");
  if (!testimonyId) redirect(`${returnTo}?message=Testimony not found.`);
  if (!reason) redirect(`${returnTo}?message=Reason is required.`);
  if (reason.length > MAX_REPORT_REASON) redirect(`${returnTo}?message=Reason must be ${MAX_REPORT_REASON} characters or fewer.`);
  if (details && details.length > MAX_REPORT_DETAILS) redirect(`${returnTo}?message=Details must be ${MAX_REPORT_DETAILS} characters or fewer.`);
  const { user } = await getCurrentAuthAndProfile();
  await assertNotBanned(user.id, `${returnTo}?message=Your account cannot report testimony right now.`);
  const admin = createAdminClient();
  const { error } = await admin.from("community_testimony_reports").insert({
    testimony_id: testimonyId,
    reporter_id: user.id,
    reason,
    details,
  });
  if (error) redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  redirect(`${returnTo}?message=Testimony report submitted.`);
}

export async function getCommunityTestimonyReportsForPlatform(): Promise<CommunityTestimonyReport[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("community_testimony_reports")
    .select("id,testimony_id,reporter_id,reason,details,status,created_at,community_testimonies:testimony_id(title,author_id,community_topics:topic_id(name))")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new Error(error.message);
  }
  const rows = (data || []) as unknown as Record<string, unknown>[];
  const userIds = rows.flatMap((row) => {
    const testimony = row.community_testimonies as Record<string, unknown> | null | undefined;
    return [typeof row.reporter_id === "string" ? row.reporter_id : null, typeof testimony?.author_id === "string" ? testimony.author_id : null];
  }).filter((id): id is string => Boolean(id));
  const profiles = await getDisplayProfiles(userIds);
  return rows.map((row) => {
    const testimony = row.community_testimonies as Record<string, unknown> | null | undefined;
    const topic = testimony?.community_topics as Record<string, unknown> | null | undefined;
    const reporterId = typeof row.reporter_id === "string" ? row.reporter_id : null;
    const authorId = typeof testimony?.author_id === "string" ? testimony.author_id : null;
    return {
      id: String(row.id),
      testimony_id: String(row.testimony_id),
      testimony_title: typeof testimony?.title === "string" ? testimony.title : "Testimony unavailable",
      topic_name: typeof topic?.name === "string" ? topic.name : null,
      reason: String(row.reason),
      details: typeof row.details === "string" ? row.details : null,
      status: row.status === "reviewed" || row.status === "resolved" || row.status === "dismissed" ? row.status : "open",
      created_at: String(row.created_at),
      reporter_label: reporterId ? profiles.get(reporterId)?.display_name || "Member" : "Deleted user",
      author_label: authorId ? profiles.get(authorId)?.display_name || "Member" : "Deleted user",
    };
  });
}

export async function reviewCommunityTestimonyReport(formData: FormData) {
  const { requirePlatformEngineer } = await import("@/lib/platform/auth");
  const profile = await requirePlatformEngineer();
  const reportId = getFormString(formData, "report_id");
  const status = getFormString(formData, "status");
  const nextStatus = status === "reviewed" || status === "resolved" || status === "dismissed" ? status : "reviewed";
  if (!reportId) redirect("/platform?message=Testimony report not found.");
  const admin = createAdminClient();
  const { error } = await admin
    .from("community_testimony_reports")
    .update({ status: nextStatus, reviewed_by_profile_id: profile.id, reviewed_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) redirect(`/platform?message=${encodeURIComponent(error.message)}`);
  revalidatePath("/platform");
  redirect("/platform?message=Testimony report updated.");
}
