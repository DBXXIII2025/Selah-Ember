import { notFound } from "next/navigation";
import { createMediaItem, getOwnedCommunityMediaForLeader } from "@/app/actions/media";
import { MediaItemForm } from "@/components/media/media-item-form";
import { DetailHeader, FormShell, PageContainer } from "@/components/ui/app-ui";

type LeaderCommunityMediaNewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LeaderCommunityMediaNewPage({ params }: LeaderCommunityMediaNewPageProps) {
  const { id } = await params;
  const media = await getOwnedCommunityMediaForLeader(id);

  if (!media.community) {
    notFound();
  }

  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref={`/leader/communities/${id}/media`}
        backLabel="Back to media library"
        eyebrow="Media management"
        title="Add media"
        description={<>Create a teaching, testimony, announcement, or resource for {media.community.name}.</>}
      />
      <FormShell className="mt-8" title="Media information" description="Choose the content type, add context, and publish when it is ready.">
          <MediaItemForm
            action={createMediaItem}
            communityId={id}
            returnTo={`/leader/communities/${id}/media`}
            submitLabel="Create media item"
          />
      </FormShell>
    </PageContainer>
  );
}
