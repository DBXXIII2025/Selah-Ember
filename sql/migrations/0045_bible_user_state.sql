-- Bible user state: private bookmarks, favorites, highlights, notes, and reading history.

create table if not exists public.bible_reading_history (
  user_id uuid primary key references auth.users(id) on delete cascade,
  translation_id text not null,
  book_id text not null,
  chapter integer not null,
  verse text,
  updated_at timestamptz not null default now(),
  constraint bible_reading_history_translation_length check (char_length(translation_id) <= 40),
  constraint bible_reading_history_book_length check (char_length(book_id) <= 12),
  constraint bible_reading_history_chapter_positive check (chapter > 0),
  constraint bible_reading_history_verse_length check (verse is null or char_length(verse) <= 12)
);

create table if not exists public.bible_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  translation_id text not null,
  book_id text not null,
  chapter integer not null,
  verse text not null,
  created_at timestamptz not null default now(),
  constraint bible_bookmarks_translation_length check (char_length(translation_id) <= 40),
  constraint bible_bookmarks_book_length check (char_length(book_id) <= 12),
  constraint bible_bookmarks_chapter_positive check (chapter > 0),
  constraint bible_bookmarks_verse_length check (char_length(verse) <= 12),
  unique (user_id, translation_id, book_id, chapter, verse)
);

create table if not exists public.bible_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  translation_id text not null,
  book_id text not null,
  chapter integer not null,
  verse text not null,
  created_at timestamptz not null default now(),
  constraint bible_favorites_translation_length check (char_length(translation_id) <= 40),
  constraint bible_favorites_book_length check (char_length(book_id) <= 12),
  constraint bible_favorites_chapter_positive check (chapter > 0),
  constraint bible_favorites_verse_length check (char_length(verse) <= 12),
  unique (user_id, translation_id, book_id, chapter, verse)
);

create table if not exists public.bible_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  translation_id text not null,
  book_id text not null,
  chapter integer not null,
  verse text not null,
  color text not null default 'ember',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bible_highlights_translation_length check (char_length(translation_id) <= 40),
  constraint bible_highlights_book_length check (char_length(book_id) <= 12),
  constraint bible_highlights_chapter_positive check (chapter > 0),
  constraint bible_highlights_verse_length check (char_length(verse) <= 12),
  constraint bible_highlights_color_check check (color in ('ember', 'gold', 'green', 'blue', 'rose')),
  unique (user_id, translation_id, book_id, chapter, verse)
);

create table if not exists public.bible_verse_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  translation_id text not null,
  book_id text not null,
  chapter integer not null,
  verse text not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bible_verse_notes_translation_length check (char_length(translation_id) <= 40),
  constraint bible_verse_notes_book_length check (char_length(book_id) <= 12),
  constraint bible_verse_notes_chapter_positive check (chapter > 0),
  constraint bible_verse_notes_verse_length check (char_length(verse) <= 12),
  constraint bible_verse_notes_note_not_blank check (length(btrim(note)) > 0),
  constraint bible_verse_notes_note_length check (char_length(note) <= 4000),
  unique (user_id, translation_id, book_id, chapter, verse)
);

create index if not exists bible_bookmarks_user_created_idx
on public.bible_bookmarks (user_id, created_at desc);

create index if not exists bible_favorites_user_created_idx
on public.bible_favorites (user_id, created_at desc);

create index if not exists bible_highlights_user_reference_idx
on public.bible_highlights (user_id, translation_id, book_id, chapter);

create index if not exists bible_verse_notes_user_reference_idx
on public.bible_verse_notes (user_id, translation_id, book_id, chapter);

alter table public.bible_reading_history enable row level security;
alter table public.bible_bookmarks enable row level security;
alter table public.bible_favorites enable row level security;
alter table public.bible_highlights enable row level security;
alter table public.bible_verse_notes enable row level security;

drop policy if exists "Users manage own Bible reading history" on public.bible_reading_history;
create policy "Users manage own Bible reading history"
on public.bible_reading_history for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own Bible bookmarks" on public.bible_bookmarks;
create policy "Users manage own Bible bookmarks"
on public.bible_bookmarks for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own Bible favorites" on public.bible_favorites;
create policy "Users manage own Bible favorites"
on public.bible_favorites for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own Bible highlights" on public.bible_highlights;
create policy "Users manage own Bible highlights"
on public.bible_highlights for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own Bible verse notes" on public.bible_verse_notes;
create policy "Users manage own Bible verse notes"
on public.bible_verse_notes for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
