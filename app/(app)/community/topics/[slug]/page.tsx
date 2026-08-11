import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOptionalAuthAndProfile } from "@/lib/auth/current";
import { getCommunityTopicBySlug, getCommunityTestimonies, getCuratedTopicScriptures, getTopicCommunityPosts } from "@/app/actions/community-topics";
import { getVisiblePrayerRequests } from "@/app/actions/prayer";
import { CommunityPostDisplay } from "@/components/community/community-post-display";
import { SensitiveTopicNotice, ShareActions, ScriptureList, TestimonyCard } from "@/components/community/community-topic-components";
import { ActionButton, ContentCard, EmptyState, PageContainer, PageHeader, SectionHeader } from "@/components/ui/app-ui";

type TopicPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const topic = await getCommunityTopicBySlug(slug);
  return {
    title: topic ? `${topic.name} Community Topic` : "Community Topic",
    description: topic?.description || "Focused Selah Ember community topic.",
  };
}

export default async function CommunityTopicPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const topic = await getCommunityTopicBySlug(slug);
  if (!topic) notFound();

  const auth = await getOptionalAuthAndProfile();
  const [posts, testimonies, prayers, scriptures] = await Promise.all([
    getTopicCommunityPosts(topic.id),
    getCommunityTestimonies(topic.slug),
    auth ? getVisiblePrayerRequests() : Promise.resolve([]),
    getCuratedTopicScriptures(topic.slug),
  ]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Community Topics"
        title={topic.name}
        description={topic.description}
        bordered
        action={auth ? <ActionButton href={`/community/topics/${topic.slug}/posts/new`}>Create post</ActionButton> : <ActionButton href="/signin">Sign in to share</ActionButton>}
      />
      <nav aria-label="Breadcrumb" className="mt-5 text-sm font-semibold text-[#67564c]">
        <Link href="/community" className="hover:text-[#8a3f1e]">Community</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/community/topics" className="hover:text-[#8a3f1e]">Topics</Link>
        <span aria-hidden="true"> / </span>
        <span>{topic.name}</span>
      </nav>
      {topic.is_sensitive ? <SensitiveTopicNotice /> : null}

      <div className="mt-8 space-y-8">
        <ContentCard as="section">
          <SectionHeader title="Scripture" description="Curated references from Selah Ember's existing Bible translations." />
          <div className="mt-5">
            <ScriptureList scriptures={scriptures} />
          </div>
        </ContentCard>

        <section>
          <SectionHeader
            title="Community"
            description="Posts explicitly shared for this topic."
            action={auth ? <ActionButton href={`/community/topics/${topic.slug}/posts/new`} size="sm" variant="secondary">New post</ActionButton> : null}
          />
          <div className="mt-5 space-y-4">
            {posts.length === 0 ? (
              <EmptyState title="No topic posts yet" description="Start a focused discussion for this topic." action={auth ? <ActionButton href={`/community/topics/${topic.slug}/posts/new`}>Create post</ActionButton> : <ActionButton href="/signin">Sign in to post</ActionButton>} />
            ) : posts.map((post) => (
              <CommunityPostDisplay key={post.id} post={post} href={`/community/posts/${post.id}`} compact />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader
            title="Personal Testimonies"
            description="Structured personal experiences, not professional advice."
            action={auth ? <ActionButton href={`/community/topics/${topic.slug}/testimonies/new`} size="sm" variant="secondary">Share testimony</ActionButton> : null}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {testimonies.length === 0 ? (
              <div className="md:col-span-2">
                <EmptyState title="No testimonies yet" description="Share a personal testimony when you are ready." action={auth ? <ActionButton href={`/community/topics/${topic.slug}/testimonies/new`}>Share testimony</ActionButton> : <ActionButton href="/signin">Sign in to share</ActionButton>} />
              </div>
            ) : testimonies.map((testimony) => (
              <TestimonyCard key={testimony.id} testimony={testimony} href={`/community/testimonies/${testimony.id}`} />
            ))}
          </div>
        </section>

        <ContentCard as="section">
          <SectionHeader title="Prayer" description="Use Selah Ember's existing Prayer space for requests connected to this topic." action={<ActionButton href="/prayer/new" size="sm" variant="secondary">New prayer</ActionButton>} />
          <div className="mt-5 space-y-3">
            {auth && prayers.length > 0 ? prayers.slice(0, 3).map((prayer) => (
              <Link key={prayer.id} href="/prayer" className="block rounded-xl border border-[#ead6c5] bg-white/70 p-4 text-sm font-semibold text-[#67564c] hover:text-[#8a3f1e]">
                {prayer.title}
              </Link>
            )) : <p className="text-sm leading-6 text-[#67564c]">Create or view prayer requests in the Prayer section.</p>}
          </div>
        </ContentCard>

        <ContentCard as="section">
          <SectionHeader title="Share" description="Choose the kind of contribution that fits what you want to offer." />
          <div className="mt-5">
            <ShareActions topic={topic} />
          </div>
        </ContentCard>
      </div>
    </PageContainer>
  );
}
