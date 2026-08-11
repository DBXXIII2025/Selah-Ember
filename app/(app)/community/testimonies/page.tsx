import type { Metadata } from "next";
import { CommunityTabs } from "@/components/community/community-tabs";
import { TestimonyCard } from "@/components/community/community-topic-components";
import { ActionButton, EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";
import { getCommunityTestimonies, getCommunityTopics } from "@/app/actions/community-topics";

type CommunityTestimoniesPageProps = {
  searchParams: Promise<{ topic?: string; message?: string }>;
};

export const metadata: Metadata = {
  title: "Community Testimonies",
  description: "Browse structured personal testimonies from the Selah Ember community.",
};

export const dynamic = "force-dynamic";

export default async function CommunityTestimoniesPage({ searchParams }: CommunityTestimoniesPageProps) {
  const params = await searchParams;
  const [topics, testimonies] = await Promise.all([
    getCommunityTopics(),
    getCommunityTestimonies(params.topic || null),
  ]);
  const selectedTopic = topics.find((topic) => topic.slug === params.topic) || null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Community"
        title="Testimonies"
        description="Personal experiences shared in a structured way, newest first."
        action={<ActionButton href={selectedTopic ? `/community/topics/${selectedTopic.slug}/testimonies/new` : "/community/topics"}>Share testimony</ActionButton>}
        bordered
      />
      <CommunityTabs active="testimonies" />

      <form className="mt-8 max-w-sm">
        <label className="text-sm font-semibold text-[#3b312b]" htmlFor="topic-filter">Filter by topic</label>
        <select id="topic-filter" name="topic" defaultValue={params.topic || ""} className="mt-2 w-full rounded-xl border border-[#d9c1ad] bg-white px-4 py-3 text-[#211814] outline-none transition focus-visible:border-[#a94720] focus-visible:ring-4 focus-visible:ring-[#a94720]/10">
          <option value="">All topics</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.slug}>{topic.name}</option>
          ))}
        </select>
        <button type="submit" className="mt-3 rounded-full bg-[#a94720] px-5 py-3 text-sm font-semibold text-white">Apply filter</button>
      </form>

      {params.message ? <div className="mt-6 rounded-xl border border-[#ead6c5] bg-white/80 p-4 text-sm text-[#67564c]">{params.message}</div> : null}

      <div className="mt-8">
        {testimonies.length === 0 ? (
          <EmptyState title="No testimonies yet" description="Choose a topic and share a testimony when you are ready." action={<ActionButton href="/community/topics">Browse topics</ActionButton>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {testimonies.map((testimony) => (
              <TestimonyCard key={testimony.id} testimony={testimony} href={`/community/testimonies/${testimony.id}`} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
