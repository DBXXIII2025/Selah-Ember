import { notFound } from "next/navigation";
import { createOpenCommunityPostWithState, getDefaultCommunity } from "@/app/actions/community-posts";
import { getCommunityTopicBySlug } from "@/app/actions/community-topics";
import { CommunityPostActionForm } from "@/components/community/community-post-action-form";
import { DetailHeader, FormShell, PageContainer } from "@/components/ui/app-ui";

type NewTopicPostPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string }>;
};

export default async function NewTopicPostPage({ params, searchParams }: NewTopicPostPageProps) {
  const [{ slug }, query, community] = await Promise.all([params, searchParams, getDefaultCommunity()]);
  const topic = await getCommunityTopicBySlug(slug);
  if (!topic) notFound();
  const returnTo = `/community/topics/${topic.slug}/posts/new`;

  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref={`/community/topics/${topic.slug}`}
        backLabel={`Back to ${topic.name}`}
        eyebrow="Topic post"
        title={`Share in ${topic.name}`}
        description="Create a Community post associated with this topic. It remains part of the existing Community feed architecture."
      />
      <div className="mt-10">
        {!community ? (
          <FormShell title="Posting unavailable">Community posting is temporarily unavailable while setup finishes.</FormShell>
        ) : (
          <FormShell title="New topic post" description={query.message}>
            <CommunityPostActionForm
              action={createOpenCommunityPostWithState}
              communityId={community.id}
              returnTo={returnTo}
              submitLabel="Post"
              showPublishToggle={false}
              topicSlug={topic.slug}
            />
          </FormShell>
        )}
      </div>
    </PageContainer>
  );
}
