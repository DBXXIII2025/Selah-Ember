import { notFound } from "next/navigation";
import { getCommunityTestimony, getCommunityTopicBySlug } from "@/app/actions/community-topics";
import { CommunityTestimonyForm } from "@/components/community/community-testimony-form";
import { DetailHeader, FormShell, PageContainer } from "@/components/ui/app-ui";

type EditTestimonyPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
};

export default async function EditTestimonyPage({ params, searchParams }: EditTestimonyPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const testimony = await getCommunityTestimony(id);
  if (!testimony || !testimony.can_edit || !testimony.topic_slug) notFound();
  const topic = await getCommunityTopicBySlug(testimony.topic_slug);
  if (!topic) notFound();
  const returnTo = `/community/testimonies/${testimony.id}/edit`;

  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref={`/community/testimonies/${testimony.id}`}
        backLabel="Go back to testimony"
        eyebrow="Edit testimony"
        title={testimony.title}
        description="Update your structured testimony and Scripture reference."
      />
      <div className="mt-10">
        <FormShell title="Edit testimony" description={query.message}>
          <CommunityTestimonyForm topic={topic} testimony={testimony} returnTo={returnTo} />
        </FormShell>
      </div>
    </PageContainer>
  );
}
