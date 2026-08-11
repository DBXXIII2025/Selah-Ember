import type { Metadata } from "next";
import { CommunityTabs } from "@/components/community/community-tabs";
import { TopicGrid, TopicSearch } from "@/components/community/community-topic-components";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";
import { getCommunityTopics } from "@/app/actions/community-topics";

type CommunityTopicsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export const metadata: Metadata = {
  title: "Community Topics",
  description: "Find focused Christian community spaces for what you are walking through.",
};

export const dynamic = "force-dynamic";

export default async function CommunityTopicsPage({ searchParams }: CommunityTopicsPageProps) {
  const [topics, params] = await Promise.all([getCommunityTopics(), searchParams]);
  const query = (params.q || "").trim().toLowerCase();
  const filteredTopics = query
    ? topics.filter((topic) => `${topic.name} ${topic.description || ""}`.toLowerCase().includes(query))
    : topics;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Community"
        title="Topics"
        description="Choose a focused community space for what you are going through."
        bordered
      />
      <CommunityTabs active="topics" />
      <div className="mt-8">
        <TopicSearch defaultValue={params.q || ""} />
        {filteredTopics.length === 0 ? (
          <EmptyState title="No topics matched" description="Try another search or return to the full topic list." />
        ) : (
          <TopicGrid topics={filteredTopics} />
        )}
      </div>
    </PageContainer>
  );
}
