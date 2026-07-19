"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getBibleChapterHref,
  getBibleReferenceKey,
  loadBibleChapter,
  normalizeBookId,
  normalizeChapter,
  normalizeTranslationId,
} from "@/lib/bible/data";
import type { BibleReference } from "@/lib/bible/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type BibleUserState = {
  bookmarks: Set<string>;
  favorites: Set<string>;
  highlights: Map<string, string>;
  notes: Map<string, string>;
};

async function requireUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/signin");
  return data.user.id;
}

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function validateVerseReference(formData: FormData): Promise<BibleReference> {
  const translationId = normalizeTranslationId(getString(formData, "translationId"));
  const bookId = normalizeBookId(getString(formData, "bookId"));
  const chapter = normalizeChapter(translationId, bookId, getString(formData, "chapter"));
  const verse = getString(formData, "verse");

  if (!verse) throw new Error("Verse is required.");

  const chapterData = await loadBibleChapter(translationId, bookId, chapter);
  if (!chapterData.verses.some((candidate) => candidate.number === verse)) {
    throw new Error("Verse was not found.");
  }

  return { translationId, bookId, chapter, verse };
}

function throwIfSupabaseError(error: { message?: string } | null | undefined) {
  if (error) throw new Error(error.message || "Bible state could not be saved.");
}

function redirectBack(reference: BibleReference) {
  revalidatePath("/bible");
  redirect(`${getBibleChapterHref(reference)}#verse-${reference.bookId}-${reference.chapter}-${reference.verse}`);
}

export async function getBibleReadingHistory(userId: string): Promise<BibleReference | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("bible_reading_history")
    .select("translation_id, book_id, chapter, verse")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;
  const translationId = normalizeTranslationId(data.translation_id);
  const bookId = normalizeBookId(data.book_id);
  return {
    translationId,
    bookId,
    chapter: normalizeChapter(translationId, bookId, data.chapter),
    verse: typeof data.verse === "string" ? data.verse : undefined,
  };
}

export async function getBibleUserState(userId: string, reference: Omit<BibleReference, "verse">): Promise<BibleUserState> {
  const admin = createAdminClient();
  const filters = {
    user_id: userId,
    translation_id: reference.translationId,
    book_id: reference.bookId,
    chapter: reference.chapter,
  };

  const [bookmarks, favorites, highlights, notes] = await Promise.all([
    admin.from("bible_bookmarks").select("verse").match(filters),
    admin.from("bible_favorites").select("verse").match(filters),
    admin.from("bible_highlights").select("verse, color").match(filters),
    admin.from("bible_verse_notes").select("verse, note").match(filters),
  ]);

  return {
    bookmarks: new Set((bookmarks.data || []).map((row) => getBibleReferenceKey({ ...reference, verse: row.verse }))),
    favorites: new Set((favorites.data || []).map((row) => getBibleReferenceKey({ ...reference, verse: row.verse }))),
    highlights: new Map((highlights.data || []).map((row) => [getBibleReferenceKey({ ...reference, verse: row.verse }), row.color])),
    notes: new Map((notes.data || []).map((row) => [getBibleReferenceKey({ ...reference, verse: row.verse }), row.note])),
  };
}

export async function saveBibleReadingLocation(reference: BibleReference) {
  const userId = await requireUserId();
  const translationId = normalizeTranslationId(reference.translationId);
  const bookId = normalizeBookId(reference.bookId);
  const chapter = normalizeChapter(translationId, bookId, reference.chapter);
  const admin = createAdminClient();

  const { error } = await admin.from("bible_reading_history").upsert(
    {
      user_id: userId,
      translation_id: translationId,
      book_id: bookId,
      chapter,
      verse: reference.verse || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  throwIfSupabaseError(error);
}

export async function toggleBibleBookmark(formData: FormData) {
  const userId = await requireUserId();
  const reference = await validateVerseReference(formData);
  const admin = createAdminClient();
  const row = {
    user_id: userId,
    translation_id: reference.translationId,
    book_id: reference.bookId,
    chapter: reference.chapter,
    verse: reference.verse,
  };
  const { data, error: lookupError } = await admin.from("bible_bookmarks").select("id").match(row).maybeSingle();
  throwIfSupabaseError(lookupError);

  if (data?.id) {
    const { error } = await admin.from("bible_bookmarks").delete().eq("id", data.id).eq("user_id", userId);
    throwIfSupabaseError(error);
  } else {
    const { error } = await admin.from("bible_bookmarks").insert(row);
    throwIfSupabaseError(error);
  }

  redirectBack(reference);
}

export async function toggleBibleFavorite(formData: FormData) {
  const userId = await requireUserId();
  const reference = await validateVerseReference(formData);
  const admin = createAdminClient();
  const row = {
    user_id: userId,
    translation_id: reference.translationId,
    book_id: reference.bookId,
    chapter: reference.chapter,
    verse: reference.verse,
  };
  const { data, error: lookupError } = await admin.from("bible_favorites").select("id").match(row).maybeSingle();
  throwIfSupabaseError(lookupError);

  if (data?.id) {
    const { error } = await admin.from("bible_favorites").delete().eq("id", data.id).eq("user_id", userId);
    throwIfSupabaseError(error);
  } else {
    const { error } = await admin.from("bible_favorites").insert(row);
    throwIfSupabaseError(error);
  }

  redirectBack(reference);
}

export async function toggleBibleHighlight(formData: FormData) {
  const userId = await requireUserId();
  const reference = await validateVerseReference(formData);
  const color = getString(formData, "color") || "ember";
  const safeColor = ["ember", "gold", "green", "blue", "rose"].includes(color) ? color : "ember";
  const admin = createAdminClient();
  const row = {
    user_id: userId,
    translation_id: reference.translationId,
    book_id: reference.bookId,
    chapter: reference.chapter,
    verse: reference.verse,
  };
  const { data, error: lookupError } = await admin.from("bible_highlights").select("id, color").match(row).maybeSingle();
  throwIfSupabaseError(lookupError);

  if (data?.id && data.color === safeColor) {
    const { error } = await admin.from("bible_highlights").delete().eq("id", data.id).eq("user_id", userId);
    throwIfSupabaseError(error);
  } else {
    const { error } = await admin.from("bible_highlights").upsert({ ...row, color: safeColor, updated_at: new Date().toISOString() }, {
      onConflict: "user_id,translation_id,book_id,chapter,verse",
    });
    throwIfSupabaseError(error);
  }

  redirectBack(reference);
}

export async function saveBibleVerseNote(formData: FormData) {
  const userId = await requireUserId();
  const reference = await validateVerseReference(formData);
  const note = getString(formData, "note");
  const admin = createAdminClient();
  const row = {
    user_id: userId,
    translation_id: reference.translationId,
    book_id: reference.bookId,
    chapter: reference.chapter,
    verse: reference.verse,
  };

  if (!note) {
    const { error } = await admin.from("bible_verse_notes").delete().match(row);
    throwIfSupabaseError(error);
  } else if (note.length <= 4000) {
    const { error } = await admin.from("bible_verse_notes").upsert({ ...row, note, updated_at: new Date().toISOString() }, {
      onConflict: "user_id,translation_id,book_id,chapter,verse",
    });
    throwIfSupabaseError(error);
  }

  redirectBack(reference);
}
