import { createCommunityTestimony, updateCommunityTestimony, type CommunityTestimony, type CommunityTopic } from "@/app/actions/community-topics";
import { getBibleBooks, getBibleTranslations } from "@/lib/bible/data";
import {
  ActionButton,
  FormActions,
  FormField,
  FormHint,
  FormLabel,
  FormSection,
  formControlClassName,
} from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";

export function CommunityTestimonyForm({
  topic,
  testimony,
  returnTo,
}: Readonly<{
  topic: CommunityTopic;
  testimony?: CommunityTestimony | null;
  returnTo: string;
}>) {
  const translations = getBibleTranslations();
  const books = getBibleBooks();
  const scripture = testimony?.scriptures[0] || null;

  return (
    <form action={testimony ? updateCommunityTestimony : createCommunityTestimony}>
      <input type="hidden" name="topic_slug" value={topic.slug} />
      <input type="hidden" name="return_to" value={returnTo} />
      {testimony ? <input type="hidden" name="testimony_id" value={testimony.id} /> : null}

      <FormSection title="Your testimony">
        <FormField>
          <FormLabel htmlFor="testimony-title" required>Title</FormLabel>
          <input id="testimony-title" name="title" maxLength={160} required defaultValue={testimony?.title || ""} className={formControlClassName} />
        </FormField>
        <FormField>
          <FormLabel htmlFor="what-i-went-through" required>What I went through</FormLabel>
          <textarea
            id="what-i-went-through"
            name="what_i_went_through"
            rows={5}
            maxLength={4000}
            required
            defaultValue={testimony?.what_i_went_through || ""}
            className={formControlClassName}
          />
        </FormField>
        <FormField>
          <FormLabel htmlFor="what-happened">What happened</FormLabel>
          <textarea id="what-happened" name="what_happened" rows={4} maxLength={4000} defaultValue={testimony?.what_happened || ""} className={formControlClassName} />
        </FormField>
        <FormField>
          <FormLabel htmlFor="what-god-taught-me">What God taught me</FormLabel>
          <textarea id="what-god-taught-me" name="what_god_taught_me" rows={4} maxLength={4000} defaultValue={testimony?.what_god_taught_me || ""} className={formControlClassName} />
        </FormField>
        <FormField>
          <FormLabel htmlFor="where-i-am-now">Where I am now</FormLabel>
          <textarea id="where-i-am-now" name="where_i_am_now" rows={4} maxLength={4000} defaultValue={testimony?.where_i_am_now || ""} className={formControlClassName} />
          <FormHint>Add at least one of these reflection fields: what happened, what God taught me, or where I am now.</FormHint>
        </FormField>
      </FormSection>

      <FormSection title="Scripture" description="Attach one structured Bible reference. Do not paste Scripture text here as the source of truth." className="mt-8 border-t border-[#ead6c5] pt-7">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField>
            <FormLabel htmlFor="translation-id">Translation</FormLabel>
            <select id="translation-id" name="translation_id" defaultValue={scripture?.translationId || translations[0]?.id || "web"} className={formControlClassName}>
              {translations.map((translation) => (
                <option key={translation.id} value={translation.id}>{translation.abbreviation}</option>
              ))}
            </select>
          </FormField>
          <FormField>
            <FormLabel htmlFor="book-id">Book</FormLabel>
            <select id="book-id" name="book_id" defaultValue={scripture?.bookId || "PSA"} className={formControlClassName}>
              {books.map((book) => (
                <option key={book.id} value={book.id}>{book.name}</option>
              ))}
            </select>
          </FormField>
          <FormField>
            <FormLabel htmlFor="chapter">Chapter</FormLabel>
            <input id="chapter" name="chapter" type="number" min={1} defaultValue={scripture?.chapter || 1} className={formControlClassName} />
          </FormField>
          <FormField>
            <FormLabel htmlFor="verse-start" required>Verse</FormLabel>
            <input id="verse-start" name="verse_start" required defaultValue={scripture?.verseStart || "1"} className={formControlClassName} />
          </FormField>
        </div>
        <FormField className="mt-4 max-w-xs">
          <FormLabel htmlFor="verse-end">Ending verse</FormLabel>
          <input id="verse-end" name="verse_end" defaultValue={scripture?.verseEnd || ""} className={formControlClassName} />
        </FormField>
        <FormField className="mt-4">
          <FormLabel htmlFor="scripture-reflection">Reflection on Scripture</FormLabel>
          <textarea id="scripture-reflection" name="scripture_reflection" rows={3} maxLength={2000} defaultValue={testimony?.scripture_reflection || ""} className={formControlClassName} />
          <FormHint>This is your reflection, not canonical Scripture text.</FormHint>
        </FormField>
      </FormSection>

      <FormActions className="mt-7">
        <ActionButton href={returnTo} variant="secondary">Cancel</ActionButton>
        <SubmitButton pendingLabel={testimony ? "Saving..." : "Sharing..."}>{testimony ? "Save testimony" : "Share testimony"}</SubmitButton>
      </FormActions>
    </form>
  );
}
