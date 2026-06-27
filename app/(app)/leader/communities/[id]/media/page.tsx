import { Library } from "lucide-react";
import { notFound } from "next/navigation";
import { deleteMediaItem, getOwnedCommunityMediaForLeader } from "@/app/actions/media";
import { MediaItemDisplay } from "@/components/media/media-item-display";
import { ActionButton, ConfirmActionPanel, DetailHeader, EmptyState, PageContainer } from "@/components/ui/app-ui";

type LeaderCommunityMediaPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LeaderCommunityMediaPage({ params }: LeaderCommunityMediaPageProps) {
  const { id } = await params;
  const media = await getOwnedCommunityMediaForLeader(id);

  if (!media.community) {
    notFound();
  }

  return (
    <PageContainer>
      <DetailHeader
        backHref={`/leader/communities/${id}`}
        backLabel="Back to management"
        eyebrow="Media management"
        title="Media library"
        description={<>Manage teachings, testimonies, notes, and resource links for {media.community.name}.</>}
        action={<ActionButton href={`/leader/communities/${id}/media/new`}>Add media</ActionButton>}
      />

      <div className="mt-10 grid gap-5">
          {media.items.length === 0 ? (
            <EmptyState
              icon={Library}
              title="No media yet"
              description="Add the first teaching, testimony, or resource link to build this library."
              action={<ActionButton href={`/leader/communities/${id}/media/new`}>Add media</ActionButton>}
            />
          ) : (
            media.items.map((item) => (
              <div key={item.id} className="space-y-3">
                <MediaItemDisplay item={item} href={`/leader/communities/${id}/media/${item.id}/edit`} compact />
                <ActionButton href={`/leader/communities/${id}/media/${item.id}/edit`} variant="secondary" size="sm">Edit media</ActionButton>
                <ConfirmActionPanel
                  action={deleteMediaItem}
                  hiddenFields={{ media_id: item.id, return_to: `/leader/communities/${id}/media` }}
                  title="Delete this media item"
                  description="The item will no longer appear in the library. This action cannot be undone."
                  actionLabel="Delete media"
                  confirmationId={`delete-media-${item.id}`}
                />
              </div>
            ))
          )}
      </div>
    </PageContainer>
  );
}
