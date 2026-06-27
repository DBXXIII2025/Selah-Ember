import { notFound } from "next/navigation";
import { createCommunityPost, getCommunityPostsForLeader } from "@/app/actions/community-posts";
import { CommunityPostForm } from "@/components/community/community-post-form";
import { DetailHeader, FormShell, PageContainer } from "@/components/ui/app-ui";

type NewCommunityUpdatePageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewCommunityUpdatePage({ params }: NewCommunityUpdatePageProps) {
  const { id } = await params;
  const data = await getCommunityPostsForLeader(id);

  if (!data.community) {
    notFound();
  }

  return (
    <PageContainer size="medium">
      <DetailHeader backHref={`/leader/communities/${id}/updates`} backLabel="Back to updates" eyebrow="Official content" title="New community update" description={<>Share an official update for {data.community.name}.</>} />
      <FormShell className="mt-8" title="Update details" description="Add text, a safe link, or an image or video attachment.">
          <CommunityPostForm
            action={createCommunityPost}
            communityId={id}
            returnTo={`/leader/communities/${id}/updates`}
            submitLabel="Publish update"
          />
      </FormShell>
    </PageContainer>
  );
}
