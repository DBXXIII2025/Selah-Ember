import Link from "next/link";
import { AlertTriangle, BookOpen, MessageCircle, Plus, Search, ShieldCheck } from "lucide-react";
import {
  deleteCommunityTestimony,
  reportCommunityTestimony,
  toggleTestimonyEncouragement,
  type CommunityTestimony,
  type CommunityTopic,
  type TopicScripture,
} from "@/app/actions/community-topics";
import { ActionButton, Badge, ConfirmActionPanel, ContentCard, FormField, FormLabel, FormNotice, formControlClassName } from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";

export function TopicGrid({ topics }: Readonly<{ topics: CommunityTopic[] }>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {topics.map((topic) => (
        <Link
          key={topic.id}
          href={`/community/topics/${topic.slug}`}
          className="group rounded-2xl border border-[#ead6c5] bg-white/75 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d79568] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a94720]/20"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#2f2722] group-hover:text-[#8a3f1e]">{topic.name}</h2>
            {topic.is_sensitive ? <Badge tone="neutral">Sensitive</Badge> : null}
          </div>
          {topic.description ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#67564c]">{topic.description}</p> : null}
        </Link>
      ))}
    </div>
  );
}

export function TopicSearch({ defaultValue = "" }: Readonly<{ defaultValue?: string }>) {
  return (
    <form className="mb-6" role="search">
      <label className="relative block">
        <span className="sr-only">Filter topics</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#715e54]" />
        <input
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder="Search topics"
          className="w-full rounded-2xl border border-[#d9b99d] bg-white/80 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#715e54] focus-visible:border-[#a94720] focus-visible:ring-4 focus-visible:ring-[#a94720]/10"
        />
      </label>
    </form>
  );
}

export function SensitiveTopicNotice() {
  return (
    <FormNotice className="mt-6 flex items-start gap-3 bg-white/80 text-[#67564c]">
      <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#8a3f1e]" />
      <span>
        Community experiences here are personal experiences. Scripture and community support are not a substitute for professional medical care.
      </span>
    </FormNotice>
  );
}

export function ScriptureList({ scriptures }: Readonly<{ scriptures: TopicScripture[] }>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {scriptures.map((scripture) => (
        <Link
          key={`${scripture.translationId}-${scripture.bookId}-${scripture.chapter}-${scripture.verseStart}-${scripture.verseEnd || ""}`}
          href={scripture.href}
          className="rounded-xl border border-[#ead6c5] bg-[#fffaf4] p-4 text-sm font-semibold text-[#8a3f1e] transition hover:bg-white"
        >
          <BookOpen aria-hidden="true" className="mb-2 h-4 w-4" />
          {scripture.label}
        </Link>
      ))}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export function TestimonyCard({ testimony, href }: Readonly<{ testimony: CommunityTestimony; href?: string }>) {
  const body = (
    <ContentCard className="h-full">
      <div className="flex flex-wrap items-center gap-2">
        {testimony.topic_name ? <Badge tone="neutral">{testimony.topic_name}</Badge> : null}
        <span className="text-xs text-[#715e54]">{formatDate(testimony.created_at)}</span>
      </div>
      <h2 className="mt-4 text-xl font-semibold text-[#2f2722]">{testimony.title}</h2>
      <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6 text-[#67564c]">{testimony.what_i_went_through}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-[#67564c]">
        <span>{testimony.author_name || "Member"}</span>
        {testimony.scriptures.length > 0 ? <Badge>Scripture linked</Badge> : null}
      </div>
    </ContentCard>
  );

  return href ? (
    <Link href={href} className="block h-full transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a94720]/20">
      {body}
    </Link>
  ) : body;
}

export function TestimonyDetail({ testimony }: Readonly<{ testimony: CommunityTestimony }>) {
  return (
    <article className="space-y-6">
      <ContentCard className="p-5 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {testimony.topic_slug && testimony.topic_name ? (
                <Link href={`/community/topics/${testimony.topic_slug}`} className="inline-flex">
                  <Badge tone="neutral">{testimony.topic_name}</Badge>
                </Link>
              ) : null}
              <span className="text-xs text-[#715e54]">{formatDate(testimony.created_at)}</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{testimony.title}</h1>
            <p className="mt-3 text-sm font-semibold text-[#67564c]">{testimony.author_name || "Member"}</p>
          </div>
          {testimony.can_edit ? <ActionButton href={`/community/testimonies/${testimony.id}/edit`} variant="secondary">Edit</ActionButton> : null}
        </div>
      </ContentCard>

      <TestimonySection title="What I went through" body={testimony.what_i_went_through} />
      {testimony.what_happened ? <TestimonySection title="What happened" body={testimony.what_happened} /> : null}
      {testimony.what_god_taught_me ? <TestimonySection title="What God taught me" body={testimony.what_god_taught_me} /> : null}
      {testimony.scripture_reflection ? <TestimonySection title="Scripture reflection" body={testimony.scripture_reflection} /> : null}
      {testimony.where_i_am_now ? <TestimonySection title="Where I am now" body={testimony.where_i_am_now} /> : null}

      {testimony.scriptures.length > 0 ? (
        <ContentCard as="section">
          <h2 className="text-xl font-semibold">Scriptures that helped me</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {testimony.scriptures.map((scripture) => (
              <Link key={scripture.id} href={scripture.href} className="rounded-full border border-[#d9b99d] bg-white px-3 py-2 text-sm font-semibold text-[#8a3f1e] hover:bg-[#fff4e8]">
                {scripture.label}
              </Link>
            ))}
          </div>
        </ContentCard>
      ) : null}

      <ContentCard as="section">
        <form action={toggleTestimonyEncouragement} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="testimony_id" value={testimony.id} />
          <input type="hidden" name="return_to" value={`/community/testimonies/${testimony.id}`} />
          <SubmitButton pendingLabel="Saving..." variant={testimony.viewer_encouraged ? "secondary" : "primary"}>
            Encouraged me
          </SubmitButton>
          <span className="text-sm text-[#67564c]">
            {testimony.encouragement_count} {testimony.encouragement_count === 1 ? "member" : "members"} encouraged
          </span>
        </form>
      </ContentCard>
    </article>
  );
}

function TestimonySection({ title, body }: Readonly<{ title: string; body: string }>) {
  return (
    <ContentCard as="section">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-4 whitespace-pre-line leading-7 text-[#3b312b]">{body}</p>
    </ContentCard>
  );
}

export function TestimonyReportForm({ testimonyId }: Readonly<{ testimonyId: string }>) {
  return (
    <ContentCard as="section">
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[#8a3f1e] marker:hidden">
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          Report testimony
        </summary>
        <form action={reportCommunityTestimony} className="mt-5 space-y-4">
          <input type="hidden" name="testimony_id" value={testimonyId} />
          <input type="hidden" name="return_to" value={`/community/testimonies/${testimonyId}`} />
          <FormField>
            <FormLabel htmlFor="report-reason" required>Reason</FormLabel>
            <input id="report-reason" name="reason" maxLength={160} required className={formControlClassName} />
          </FormField>
          <FormField>
            <FormLabel htmlFor="report-details">Details</FormLabel>
            <textarea id="report-details" name="details" rows={3} maxLength={1000} className={formControlClassName} />
          </FormField>
          <SubmitButton pendingLabel="Submitting..." variant="secondary">Submit report</SubmitButton>
        </form>
      </details>
    </ContentCard>
  );
}

export function ShareActions({ topic }: Readonly<{ topic: CommunityTopic }>) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <ActionButton href={`/community/topics/${topic.slug}/posts/new`} variant="secondary">
        <MessageCircle aria-hidden="true" className="h-4 w-4" />
        Community post
      </ActionButton>
      <ActionButton href={`/community/topics/${topic.slug}/testimonies/new`}>
        <Plus aria-hidden="true" className="h-4 w-4" />
        Testimony
      </ActionButton>
      <ActionButton href="/prayer/new" variant="secondary">Prayer request</ActionButton>
    </div>
  );
}

export function TestimonyDeletePanel({ testimony }: Readonly<{ testimony: CommunityTestimony }>) {
  if (!testimony.can_edit) return null;
  return (
    <ConfirmActionPanel
      action={deleteCommunityTestimony}
      hiddenFields={{ testimony_id: testimony.id, return_to: "/community/testimonies" }}
      title="Delete this testimony"
      description="This removes the testimony from community view and scrubs its sensitive content."
      actionLabel="Delete testimony"
      confirmationId={`delete-testimony-${testimony.id}`}
      className="mt-6"
    />
  );
}
