import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, ChevronLeft, ChevronRight, Heart, Highlighter, Search, StickyNote } from "lucide-react";
import {
  getBibleReadingHistory,
  getBibleUserState,
  saveBibleVerseNote,
  toggleBibleBookmark,
  toggleBibleFavorite,
  toggleBibleHighlight,
} from "@/app/actions/bible";
import { BibleReaderShell, BibleVerseShareTools } from "@/components/bible/bible-reader-client";
import { ActionButton, Badge, ContentCard, FormField, FormLabel, PageContainer, PageHeader, formControlClassName } from "@/components/ui/app-ui";
import {
  getAdjacentBibleChapter,
  getBibleBook,
  getBibleBooks,
  getBibleChapterHref,
  getBibleReferenceKey,
  getBibleTranslations,
  getBibleVerseHref,
  loadBibleChapter,
  normalizeBookId,
  normalizeChapter,
  normalizeTranslationId,
  searchBible,
} from "@/lib/bible/data";
import type { BibleReference, BibleSearchResult, BibleVerse } from "@/lib/bible/types";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/server";

type BiblePageProps = {
  searchParams: Promise<{
    translation?: string;
    book?: string;
    chapter?: string;
    q?: string;
  }>;
};

const highlightClasses: Record<string, string> = {
  ember: "bg-[#fff1df]",
  gold: "bg-[#fff8c5]",
  green: "bg-[#eaf7e9]",
  blue: "bg-[#eaf2ff]",
  rose: "bg-[#fff0f3]",
};

function HiddenReferenceFields({ reference }: Readonly<{ reference: BibleReference }>) {
  return (
    <>
      <input type="hidden" name="translationId" value={reference.translationId} />
      <input type="hidden" name="bookId" value={reference.bookId} />
      <input type="hidden" name="chapter" value={reference.chapter} />
      <input type="hidden" name="verse" value={reference.verse || ""} />
    </>
  );
}

function TestamentBookOptions({ translationId }: Readonly<{ translationId: string }>) {
  const books = getBibleBooks();
  return (
    <>
      <optgroup label="Old Testament">
        {books.filter((book) => book.testament === "OT").map((book) => (
          <option key={book.id} value={book.id}>
            {book.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="New Testament">
        {books.filter((book) => book.testament === "NT").map((book) => (
          <option key={book.id} value={book.id} disabled={!book.chapters[translationId]}>
            {book.name}
          </option>
        ))}
      </optgroup>
    </>
  );
}

function SearchResults({ results, query }: Readonly<{ results: BibleSearchResult[]; query: string }>) {
  if (!query) return null;

  return (
    <ContentCard as="section" className="mt-6">
      <div className="flex items-center gap-2">
        <Search aria-hidden="true" className="h-5 w-5 text-[#9b4d25]" />
        <h2 className="text-xl font-semibold">Search results</h2>
      </div>
      {results.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-[#67564c]">No verses matched that search.</p>
      ) : (
        <ol className="mt-5 space-y-4">
          {results.map((result) => (
            <li key={`${result.translationId}-${result.bookId}-${result.chapter}-${result.verse}`} className="rounded-xl border border-[#ead6c5] bg-white/80 p-4">
              <Link
                href={getBibleVerseHref({
                  translationId: result.translationId,
                  bookId: result.bookId,
                  chapter: result.chapter,
                  verse: result.verse,
                })}
                className="font-semibold text-[#8a3f1e] underline-offset-4 hover:underline"
              >
                {result.reference}
              </Link>
              <p className="mt-2 text-sm leading-6 text-[#3b312b]">{result.text}</p>
            </li>
          ))}
        </ol>
      )}
    </ContentCard>
  );
}

function VerseStateForms({
  reference,
  isBookmarked,
  isFavorite,
  highlight,
  note,
}: Readonly<{
  reference: BibleReference;
  isBookmarked: boolean;
  isFavorite: boolean;
  highlight?: string;
  note?: string;
}>) {
  return (
    <div className="mt-4 space-y-3 text-base leading-6">
      <div className="flex flex-wrap gap-2">
        <form action={toggleBibleBookmark}>
          <HiddenReferenceFields reference={reference} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9b99d] bg-white px-3 py-2 text-sm font-semibold text-[#3b312b] transition hover:bg-[#fff4e8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a94720]/20"
            aria-pressed={isBookmarked}
          >
            <Bookmark aria-hidden="true" className={cn("h-4 w-4", isBookmarked && "fill-[#a94720] text-[#a94720]")} />
            <span>{isBookmarked ? "Bookmarked" : "Bookmark"}</span>
            <span className="sr-only">{isBookmarked ? "Remove private bookmark" : "Save private bookmark"}</span>
          </button>
        </form>
        <form action={toggleBibleFavorite}>
          <HiddenReferenceFields reference={reference} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9b99d] bg-white px-3 py-2 text-sm font-semibold text-[#3b312b] transition hover:bg-[#fff4e8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a94720]/20"
            aria-pressed={isFavorite}
          >
            <Heart aria-hidden="true" className={cn("h-4 w-4", isFavorite && "fill-[#a94720] text-[#a94720]")} />
            <span>{isFavorite ? "Favorited" : "Favorite"}</span>
          </button>
        </form>
        <form action={toggleBibleHighlight} className="flex flex-wrap items-center gap-2">
          <HiddenReferenceFields reference={reference} />
          <input type="hidden" name="color" value="gold" />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9b99d] bg-white px-3 py-2 text-sm font-semibold text-[#3b312b] transition hover:bg-[#fff4e8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a94720]/20"
            aria-pressed={Boolean(highlight)}
          >
            <Highlighter aria-hidden="true" className={cn("h-4 w-4", highlight && "text-[#a94720]")} />
            <span>{highlight ? "Highlighted" : "Highlight"}</span>
          </button>
        </form>
      </div>
      <details className="rounded-xl border border-[#ead6c5] bg-white/75 p-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[#3b312b] marker:hidden">
          <StickyNote aria-hidden="true" className="h-4 w-4 text-[#9b4d25]" />
          Private note
          {note ? <Badge tone="ember">Saved</Badge> : null}
        </summary>
        <form action={saveBibleVerseNote} className="mt-3 space-y-3">
          <HiddenReferenceFields reference={reference} />
          <FormField>
            <FormLabel htmlFor={`note-${reference.bookId}-${reference.chapter}-${reference.verse}`}>Note for this verse</FormLabel>
            <textarea
              id={`note-${reference.bookId}-${reference.chapter}-${reference.verse}`}
              name="note"
              rows={3}
              maxLength={4000}
              defaultValue={note || ""}
              className={formControlClassName}
            />
          </FormField>
          <ActionButton type="submit" size="sm">Save note</ActionButton>
        </form>
      </details>
    </div>
  );
}

function BibleVerseRow({
  verse,
  bookName,
  translationAbbreviation,
  reference,
  isBookmarked,
  isFavorite,
  highlight,
  note,
}: Readonly<{
  verse: BibleVerse;
  bookName: string;
  translationAbbreviation: string;
  reference: BibleReference;
  isBookmarked: boolean;
  isFavorite: boolean;
  highlight?: string;
  note?: string;
}>) {
  const label = `${bookName} ${reference.chapter}:${verse.number} ${translationAbbreviation}`;
  const href = getBibleVerseHref(reference);

  return (
    <article id={`verse-${reference.bookId}-${reference.chapter}-${verse.number}`} className={cn("scroll-mt-28 rounded-2xl p-3", highlight && highlightClasses[highlight])}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <p className="max-w-4xl">
          <sup className="mr-2 align-super text-sm font-bold text-[#9b4d25]">{verse.number}</sup>
          <span>{verse.text}</span>
        </p>
        <BibleVerseShareTools reference={label} text={verse.text} href={href} />
      </div>
      <VerseStateForms reference={reference} isBookmarked={isBookmarked} isFavorite={isFavorite} highlight={highlight} note={note} />
    </article>
  );
}

export default async function BiblePage({ searchParams }: BiblePageProps) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/signin");

  const params = await searchParams;
  const history = !params.translation && !params.book && !params.chapter ? await getBibleReadingHistory(auth.user.id) : null;
  const translationId = normalizeTranslationId(params.translation || history?.translationId);
  const bookId = normalizeBookId(params.book || history?.bookId);
  const chapterNumber = normalizeChapter(translationId, bookId, params.chapter || history?.chapter);
  const searchQuery = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const book = getBibleBook(bookId);
  const [chapter, userState, searchResults] = await Promise.all([
    loadBibleChapter(translationId, bookId, chapterNumber),
    getBibleUserState(auth.user.id, { translationId, bookId, chapter: chapterNumber }),
    searchQuery ? searchBible(translationId, searchQuery) : Promise.resolve([]),
  ]);
  const translations = getBibleTranslations();
  const previousChapter = getAdjacentBibleChapter(translationId, bookId, chapterNumber, "previous");
  const nextChapter = getAdjacentBibleChapter(translationId, bookId, chapterNumber, "next");
  const chapterCount = book.chapters[translationId] || 1;
  const translation = translations.find((candidate) => candidate.id === translationId) || translations[0];

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Bible"
        title="Bible"
        description="Read Scripture, search passages, and keep private bookmarks, highlights, favorites, and verse notes."
        bordered
      />

      <ContentCard as="section" className="mt-8">
        <form className="grid gap-4 lg:grid-cols-[1fr_1fr_0.7fr_1.2fr_auto] lg:items-end" method="get">
          <FormField>
            <FormLabel htmlFor="translation">Translation</FormLabel>
            <select id="translation" name="translation" defaultValue={translationId} className={formControlClassName}>
              {translations.map((translation) => (
                <option key={translation.id} value={translation.id}>
                  {translation.abbreviation} - {translation.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField>
            <FormLabel htmlFor="book">Book</FormLabel>
            <select id="book" name="book" defaultValue={bookId} className={formControlClassName}>
              <TestamentBookOptions translationId={translationId} />
            </select>
          </FormField>
          <FormField>
            <FormLabel htmlFor="chapter">Chapter</FormLabel>
            <select id="chapter" name="chapter" defaultValue={chapterNumber} className={formControlClassName}>
              {Array.from({ length: chapterCount }).map((_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
          </FormField>
          <FormField>
            <FormLabel htmlFor="q">Search or reference</FormLabel>
            <input
              id="q"
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="John 3:16 or mercy endures"
              maxLength={120}
              className={formControlClassName}
            />
          </FormField>
          <ActionButton type="submit" className="mt-2 lg:mb-0.5">Open</ActionButton>
        </form>
      </ContentCard>

      <SearchResults results={searchResults} query={searchQuery} />

      <section className="mt-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="solid">{translation.abbreviation}</Badge>
              <Badge tone="neutral">{book.testament === "OT" ? "Old Testament" : "New Testament"}</Badge>
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              {book.name} {chapterNumber}
            </h2>
            <p className="mt-2 text-sm text-[#67564c]">
              Chapter {chapterNumber} of {chapterCount}
            </p>
          </div>
          <nav className="flex flex-wrap gap-3" aria-label="Chapter navigation">
            {previousChapter ? (
              <ActionButton href={getBibleChapterHref(previousChapter)} variant="secondary">
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                Previous
              </ActionButton>
            ) : null}
            {nextChapter ? (
              <ActionButton href={getBibleChapterHref(nextChapter)} variant="secondary">
                Next
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </ActionButton>
            ) : null}
          </nav>
        </div>
        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-[#ead6c5]"
          role="progressbar"
          aria-label="Chapter reading progress"
          aria-valuemin={1}
          aria-valuemax={chapterCount}
          aria-valuenow={chapterNumber}
          aria-valuetext={`Chapter ${chapterNumber} of ${chapterCount}`}
        >
          <div className="h-full rounded-full bg-[#a94720]" style={{ width: `${Math.max(2, Math.round((chapterNumber / chapterCount) * 100))}%` }} />
        </div>

        <BibleReaderShell reference={{ translationId, bookId, chapter: chapterNumber }}>
          {chapter.paragraphs.map((paragraph, paragraphIndex) => (
            <div key={`${paragraph.type}-${paragraphIndex}`} className="space-y-3">
              {paragraph.verses.map((verse) => {
                const verseReference = { translationId, bookId, chapter: chapterNumber, verse: verse.number };
                const key = getBibleReferenceKey(verseReference);
                return (
                  <BibleVerseRow
                    key={key}
                    verse={verse}
                    bookName={book.name}
                    translationAbbreviation={translation.abbreviation}
                    reference={verseReference}
                    isBookmarked={userState.bookmarks.has(key)}
                    isFavorite={userState.favorites.has(key)}
                    highlight={userState.highlights.get(key)}
                    note={userState.notes.get(key)}
                  />
                );
              })}
            </div>
          ))}
        </BibleReaderShell>

        <ContentCard as="section" className="mt-8">
          <h2 className="text-lg font-semibold">Translation license</h2>
          {translations.filter((translation) => translation.id === translationId).map((translation) => (
            <p key={translation.id} className="mt-3 text-sm leading-6 text-[#67564c]">
              {translation.name} ({translation.abbreviation}) is provided by {translation.publisher}. {translation.license} {translation.attribution}
            </p>
          ))}
        </ContentCard>
      </section>
    </PageContainer>
  );
}
