import { notFound } from "next/navigation";
import { getOwnedCommunityMediaForLeader, updateMediaItem } from "@/app/actions/media";
import { MediaItemForm } from "@/components/media/media-item-form";
import { DetailHeader, FormShell, PageContainer } from "@/components/ui/app-ui";

type LeaderCommunityMediaEditPageProps = {
  params: Promise<{
    id: string;
    mediaId: string;
  }>;
};

export default async function LeaderCommunityMediaEditPage({ params }: LeaderCommunityMediaEditPageProps) {
  const { id, mediaId } = await params;
  const media = await getOwnedCommunityMediaForLeader(id);

  if (!media.community) {
    notFound();
  }

  const item = media.items.find((entry) => entry.id === mediaId);

  if (!item) {
    notFound();
  }

  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref={`/leader/communities/${id}/media`}
        backLabel="Back to media library"
        eyebrow="Media management"
        title="Edit media"
        description="Update this media item without changing its existing library route."
      />
      <FormShell className="mt-8" title="Media information" description="Review the details and save only the changes you intend to publish.">
          <MediaItemForm
            action={updateMediaItem}
            communityId={id}
            returnTo={`/leader/communities/${id}/media`}
            submitLabel="Save changes"
            item={item}
          />
      </FormShell>
    </PageContainer>
  );
}
