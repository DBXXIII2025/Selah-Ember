export type BibleTranslation = {
  id: string;
  name: string;
  abbreviation: string;
  publisher: string;
  license: string;
  attribution: string;
  sourceUrl: string;
};

export type BibleBook = {
  id: string;
  name: string;
  abbreviation: string;
  testament: "OT" | "NT";
  order: number;
  chapters: Record<string, number>;
};

export type BibleVerse = {
  number: string;
  text: string;
};

export type BibleParagraph = {
  type: string;
  verses: BibleVerse[];
};

export type BibleChapter = {
  translation: string;
  bookId: string;
  chapter: number;
  paragraphs: BibleParagraph[];
  verses: BibleVerse[];
};

export type BibleSearchResult = {
  translationId: string;
  reference: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verse: string;
  text: string;
};

export type BibleReference = {
  translationId: string;
  bookId: string;
  chapter: number;
  verse?: string;
};
