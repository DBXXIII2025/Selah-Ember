import type { Metadata } from "next";
import { CommunityTabs } from "@/components/community/community-tabs";
import { CommunityTopicPicker } from "@/components/community/community-topic-picker";
import { PageContainer, PageHeader } from "@/components/ui/app-ui";
import { getCommunityTopics } from "@/app/actions/community-topics";

export const metadata: Metadata = {
  title: "Community Topics",
  description: "Find focused Christian community spaces for what you are walking through.",
};

export const dynamic = "force-dynamic";

export default async function CommunityTopicsPage() {
  const topics = await getCommunityTopics();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Community"
        title="Topics"
        description="Choose a focused community space for what you are going through."
        bordered
      />
      <CommunityTabs active="topics" />
      <section className="mt-8 max-w-2xl rounded-2xl border border-[#ead6c5] bg-white/85 p-6">
        <h2 className="text-xl font-semibold">Find your conversation</h2>
        <p className="mt-2 mb-5 text-sm leading-6 text-[#67564c]">Select a topic to browse discussions, Scripture, and testimonies. All topics are available in one menu.</p>
        <CommunityTopicPicker topics={topics} />
      </section>
    </PageContainer>
  );
}
