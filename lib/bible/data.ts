import { readFile } from "node:fs/promises";
import path from "node:path";
import books from "@/data/bible/catalog.json";
import translations from "@/data/bible/translations.json";
import type { BibleBook, BibleChapter, BibleReference, BibleSearchResult, BibleTranslation } from "@/lib/bible/types";

type SearchIndexEntry = {
  reference: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verse: string;
  text: string;
};

type BibleBookFile = {
  translation: string;
  bookId: string;
  chapters: BibleChapter[];
};

const bibleBooks = books as BibleBook[];
const bibleTranslations = translations as BibleTranslation[];
const translationIds = new Set(bibleTranslations.map((translation) => translation.id));
const bookIds = new Set(bibleBooks.map((book) => book.id));
const dataRoot = path.join(process.cwd(), "data", "bible");

const aliases = bibleBooks
  .flatMap((book) => [
    { alias: normalizeReferencePart(book.name), book },
    { alias: normalizeReferencePart(book.abbreviation), book },
    { alias: normalizeReferencePart(book.id), book },
  ])
  .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.alias === entry.alias) === index)
  .sort((a, b) => b.alias.length - a.alias.length);

function normalizeReferencePart(value: string) {
  return value.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

export function getBibleTranslations() {
  return bibleTranslations;
}

export function getBibleBooks() {
  return bibleBooks;
}

export function normalizeTranslationId(value?: string | null) {
  return value && translationIds.has(value) ? value : bibleTranslations[0].id;
}

export function normalizeBookId(value?: string | null) {
  const upper = value?.toUpperCase();
  return upper && bookIds.has(upper) ? upper : bibleBooks[0].id;
}

export function getBibleBook(bookId: string) {
  return bibleBooks.find((book) => book.id === bookId) || bibleBooks[0];
}

export function getChapterCount(translationId: string, bookId: string) {
  const book = getBibleBook(bookId);
  return book.chapters[translationId] || book.chapters[bibleTranslations[0].id] || 1;
}

export function normalizeChapter(translationId: string, bookId: string, value?: string | number | null) {
  const raw = typeof value === "number" ? value : Number.parseInt(String(value || "1"), 10);
  const count = getChapterCount(translationId, bookId);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  if (raw > count) return count;
  return raw;
}

export function getBibleReferenceKey(reference: BibleReference) {
  return `${reference.translationId}:${reference.bookId}:${reference.chapter}:${reference.verse || ""}`;
}

export function getBibleChapterHref(reference: Omit<BibleReference, "verse">) {
  return `/bible?translation=${encodeURIComponent(reference.translationId)}&book=${encodeURIComponent(reference.bookId)}&chapter=${reference.chapter}`;
}

export function getBibleVerseHref(reference: BibleReference) {
  const base = getBibleChapterHref(reference);
  return reference.verse ? `${base}#verse-${reference.bookId}-${reference.chapter}-${reference.verse}` : base;
}

export function getAdjacentBibleChapter(translationId: string, bookId: string, chapter: number, direction: "previous" | "next") {
  const book = getBibleBook(bookId);
  const currentIndex = bibleBooks.findIndex((candidate) => candidate.id === book.id);
  const chapterCount = getChapterCount(translationId, book.id);

  if (direction === "previous") {
    if (chapter > 1) return { translationId, bookId: book.id, chapter: chapter - 1 };
    const previousBook = bibleBooks[currentIndex - 1];
    if (!previousBook) return null;
    return { translationId, bookId: previousBook.id, chapter: getChapterCount(translationId, previousBook.id) };
  }

  if (chapter < chapterCount) return { translationId, bookId: book.id, chapter: chapter + 1 };
  const nextBook = bibleBooks[currentIndex + 1];
  return nextBook ? { translationId, bookId: nextBook.id, chapter: 1 } : null;
}

export async function loadBibleChapter(translationId: string, bookId: string, chapter: number): Promise<BibleChapter> {
  const safeTranslation = normalizeTranslationId(translationId);
  const safeBook = normalizeBookId(bookId);
  const safeChapter = normalizeChapter(safeTranslation, safeBook, chapter);
  const filePath = path.join(dataRoot, "books", safeTranslation, `${safeBook}.json`);
  const book = JSON.parse(await readFile(filePath, "utf8")) as BibleBookFile;
  return book.chapters.find((candidate) => candidate.chapter === safeChapter) || book.chapters[0];
}

export function parseBibleReference(query: string, translationId: string): BibleReference | null {
  const normalized = normalizeReferencePart(query);
  if (!normalized) return null;

  for (const { alias, book } of aliases) {
    if (!normalized.startsWith(alias)) continue;
    const rest = normalized.slice(alias.length).trim();
    const match = rest.match(/^(\d+)(?::(\d+[a-z]?))?$/i);
    if (!match) continue;
    const chapter = normalizeChapter(translationId, book.id, match[1]);
    return {
      translationId,
      bookId: book.id,
      chapter,
      verse: match[2],
    };
  }

  return null;
}

export async function searchBible(translationId: string, query: string, limit = 40): Promise<BibleSearchResult[]> {
  const safeTranslation = normalizeTranslationId(translationId);
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const reference = parseBibleReference(trimmed, safeTranslation);
  if (reference) {
    const chapter = await loadBibleChapter(reference.translationId, reference.bookId, reference.chapter);
    const book = getBibleBook(reference.bookId);
    const verses = reference.verse ? chapter.verses.filter((verse) => verse.number === reference.verse) : chapter.verses;
    return verses.slice(0, limit).map((verse) => ({
      translationId: safeTranslation,
      reference: `${book.name} ${reference.chapter}:${verse.number}`,
      bookId: book.id,
      bookName: book.name,
      chapter: reference.chapter,
      verse: verse.number,
      text: verse.text,
    }));
  }

  const indexPath = path.join(dataRoot, "search", `${safeTranslation}.json`);
  const entries = JSON.parse(await readFile(indexPath, "utf8")) as SearchIndexEntry[];
  const terms = normalizeReferencePart(trimmed).split(" ").filter(Boolean);
  const phrase = normalizeReferencePart(trimmed);
  const results: BibleSearchResult[] = [];

  for (const entry of entries) {
    const haystack = normalizeReferencePart(`${entry.reference} ${entry.text}`);
    const matches = trimmed.includes("\"")
      ? haystack.includes(phrase.replace(/"/g, ""))
      : terms.every((term) => haystack.includes(term));

    if (!matches) continue;
    results.push({ translationId: safeTranslation, ...entry });
    if (results.length >= limit) break;
  }

  return results;
}
