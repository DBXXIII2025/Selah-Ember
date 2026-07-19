# Bible

Selah Ember includes a first-party Bible reader for signed-in users at `/bible`. The reader is designed for Scripture reading, search, and private user state without adding social metrics or public profile behavior.

## Included Translations

Only translations that are both legitimate Christian Bible translations and redistributable in the application are included.

| Translation | Abbreviation | Publisher/source | License status | Attribution |
| --- | --- | --- | --- | --- |
| World English Bible | WEB | eBible.org / World English Bible contributors | Public domain | Identify the text as World English Bible. |
| King James Version, Cambridge Paragraph Bible | KJV CPB | Cambridge University Press edition distributed by eBible.org | Public domain in the United States; Crown rights may apply in the United Kingdom | Identify the text as King James Version, Cambridge Paragraph Bible. |
| Berean Standard Bible | BSB | Bible Hub / Berean Bible Translation Committee | Public domain | Identify the text as Berean Standard Bible. |

The Open English Bible was not included because the available text is not a complete Old Testament and New Testament dataset.

## Data Model

Bible text is stored as structured static JSON under `data/bible`:

- `catalog.json` contains the canonical 66-book Protestant ordering, book names, abbreviations, testament, and chapter counts per translation.
- `translations.json` records translation metadata, source, license status, and attribution requirements.
- `books/<translation>/<book>.json` stores a single canonical book with chapter, paragraph, and verse structure.
- `search/<translation>.json` stores a bounded lookup index used by server-side search.

The app reads one book file at a time for normal reading and renders only the selected chapter. Search loads the selected translation index only.

## Private User State

Migration `0045_bible_user_state.sql` adds private authenticated user state:

- `bible_reading_history`
- `bible_bookmarks`
- `bible_favorites`
- `bible_highlights`
- `bible_verse_notes`

All rows belong to `auth.users(id)` and cascade on account deletion. Row-level security allows authenticated users to manage only their own Bible state.

## Routes And Integration

- `/bible` is an authenticated Bible reader.
- Authenticated navigation labels the item as `Bible`.
- Verse links use stable query/hash locations, which can be reused by Study Rooms, messages, and future Scripture attachments.

## Limitations

- Initial release includes WEB, KJV CPB, and BSB only.
- Keyword search is server-side and bounded, but it is not a full-text ranking engine.
- Study Rooms and messages can link to Bible references through stable `/bible` URLs; richer attachment pickers can build on this data model later.
