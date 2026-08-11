import { notFound } from "next/navigation";
import { getCommunityTopicBySlug } from "@/app/actions/community-topics";
import { CommunityTestimonyForm } from "@/components/community/community-testimony-form";
import { DetailHeader, FormNotice, FormShell, PageContainer } from "@/components/ui/app-ui";

type NewTopicTestimonyPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string }>;
};

export default async function NewTopicTestimonyPage({ params, searchParams }: NewTopicTestimonyPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const topic = await getCommunityTopicBySlug(slug);
  if (!topic) notFound();
  const returnTo = `/community/topics/${topic.slug}/testimonies/new`;

  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref={`/community/topics/${topic.slug}`}
        backLabel={`Back to ${topic.name}`}
        eyebrow="Personal testimony"
        title={`Share a testimony in ${topic.name}`}
        description="Share your personal experience in a structured way. Testimonies are not professional advice."
      />
      {topic.is_sensitive ? (
        <FormNotice className="mt-6">
          Community experiences are personal experiences. Scripture and community support are not a substitute for professional medical care.
        </FormNotice>
      ) : null}
      <div className="mt-10">
        <FormShell title="New testimony" description={query.message}>
          <CommunityTestimonyForm topic={topic} returnTo={returnTo} />
        </FormShell>
      </div>
    </PageContainer>
  );
}
