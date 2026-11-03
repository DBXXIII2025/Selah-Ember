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
import { BiblePassagePanel } from "@/components/bible/bible-passage-panel";
import { ActionButton, Badge, ContentCard, FormField, FormLabel, PageContainer, formControlClassName } from "@/components/ui/app-ui";
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
    <div className="mt-3 space-y-3 text-sm leading-6">
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
    <article id={`verse-${reference.bookId}-${reference.chapter}-${verse.number}`}
      className={cn("group scroll-mt-28 border-b border-[#e9ddcf] px-1 py-3 last:border-b-0 sm:py-4", highlight && highlightClasses[highlight])}>
      <p className="max-w-[69ch] font-serif text-[#30251f]">
        <sup className="mr-2 align-super font-sans text-xs font-bold text-[#9b4d25]">{verse.number}</sup>
        <span>{verse.text}</span>
      </p>
      <details className="mt-1">
        <summary className="inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[#956a4f] transition hover:bg-[#f8e7d6] hover:text-[#8a3f1e]">
          {isBookmarked || isFavorite || highlight || note ? "Saved · " : ""}
          Verse tools <span aria-hidden="true">⌄</span>
        </summary>
        <div className="mt-2 rounded-xl border border-[#ead6c5] bg-[#fff9f1] p-3 sm:p-4">
          <BibleVerseShareTools reference={label} text={verse.text} href={href} />
          <VerseStateForms reference={reference} isBookmarked={isBookmarked} isFavorite={isFavorite} highlight={highlight} note={note} />
        </div>
      </details>
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
    <PageContainer className="py-5 sm:py-8">
      <div className="mb-7 border-b border-[#dfc6ad] pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9b4d25]">Scripture library</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-[#211814] sm:text-4xl">The Bible</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#67564c]">A peaceful place to read, reflect, bookmark, and study at your own pace.</p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[16.5rem_minmax(0,1fr)] xl:gap-8">
        <BiblePassagePanel>
          <div className="mb-5">
            <h2 className="text-base font-bold text-[#211814]">Find a passage</h2>
            <p className="mt-1 text-xs leading-5 text-[#67564c]">Choose a translation, book, chapter, or search Scripture.</p>
          </div>
          <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1" method="get">
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
          <ActionButton type="submit" className="mt-2 w-full">Open</ActionButton>
        </form>
        </BiblePassagePanel>
        <div className="min-w-0">
          <SearchResults results={searchResults} query={searchQuery} />
          <section aria-label="Scripture chapter" className="mx-auto max-w-[56rem] overflow-hidden rounded-2xl border border-[#ead6c5] bg-[#fffdf9] px-4 py-6 shadow-sm sm:px-8 sm:py-8">
            <div className="flex flex-col gap-5 border-b border-[#ead6c5] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="solid">{translation.abbreviation}</Badge>
                  <Badge tone="neutral">{book.testament === "OT" ? "Old Testament" : "New Testament"}</Badge>
                </div>
                <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#211814] sm:text-[2.75rem]">{book.name} {chapterNumber}</h2>
                <p className="mt-1 text-xs text-[#67564c]">Chapter {chapterNumber} of {chapterCount}</p>
              </div>
              <nav className="flex flex-wrap gap-2" aria-label="Chapter navigation">
                {previousChapter ? <ActionButton href={getBibleChapterHref(previousChapter)} variant="secondary" size="sm"><ChevronLeft aria-hidden="true" className="h-4 w-4" />Previous</ActionButton> : null}
                {nextChapter ? <ActionButton href={getBibleChapterHref(nextChapter)} variant="secondary" size="sm">Next<ChevronRight aria-hidden="true" className="h-4 w-4" /></ActionButton> : null}
              </nav>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f0e0d1]" role="progressbar"
              aria-label="Chapter reading progress" aria-valuemin={1} aria-valuemax={chapterCount} aria-valuenow={chapterNumber}
              aria-valuetext={`Chapter ${chapterNumber} of ${chapterCount}`}>
              <div className="h-full rounded-full bg-[#a94720]" style={{ width: `${Math.max(2, Math.round((chapterNumber / chapterCount) * 100))}%` }} />
            </div>
            <BibleReaderShell reference={{ translationId, bookId, chapter: chapterNumber }}>
          {chapter.paragraphs.map((paragraph, paragraphIndex) => (
            <div key={`${paragraph.type}-${paragraphIndex}`} className="space-y-0">
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
            <details className="mt-8 border-t border-[#ead6c5] pt-5">
              <summary className="cursor-pointer text-xs font-semibold text-[#8a3f1e]">Translation attribution and license</summary>
              <div className="mt-3 text-xs leading-6 text-[#67564c]">{translations.filter((translation) => translation.id === translationId).map((translation) => (
            <p key={translation.id} className="mt-3 text-sm leading-6 text-[#67564c]">
              {translation.name} ({translation.abbreviation}) is provided by {translation.publisher}. {translation.license} {translation.attribution}
            </p>
          ))}</div>
            </details>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
