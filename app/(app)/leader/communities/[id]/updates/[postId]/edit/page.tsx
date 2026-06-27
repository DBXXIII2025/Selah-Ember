import { notFound } from "next/navigation";
import { getCommunityPostForLeader, updateCommunityPost } from "@/app/actions/community-posts";
import { CommunityPostForm } from "@/components/community/community-post-form";
import { DetailHeader, FormShell, PageContainer } from "@/components/ui/app-ui";

type EditCommunityUpdatePageProps = {
  params: Promise<{ id: string; postId: string }>;
};

export default async function EditCommunityUpdatePage({ params }: EditCommunityUpdatePageProps) {
  const { id, postId } = await params;
  const data = await getCommunityPostForLeader(id, postId);

  if (!data.community || !data.post) {
    notFound();
  }

  return (
    <PageContainer size="medium">
      <DetailHeader backHref={`/leader/communities/${id}/updates`} backLabel="Back to updates" eyebrow="Official content" title="Edit community update" description="Update this existing public post." />
      <FormShell className="mt-8" title="Update details" description="Review the content and save only the intended changes.">
          <CommunityPostForm
            action={updateCommunityPost}
            communityId={id}
            returnTo={`/leader/communities/${id}/updates`}
            submitLabel="Save update"
            post={data.post}
          />
      </FormShell>
    </PageContainer>
  );
}
