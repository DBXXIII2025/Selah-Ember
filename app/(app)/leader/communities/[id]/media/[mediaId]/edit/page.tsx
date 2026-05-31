import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnedCommunityMediaForLeader, updateMediaItem } from "@/app/actions/media";
import { MediaItemForm } from "@/components/media/media-item-form";

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
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <Link href={`/leader/communities/${id}/media`} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to media library
        </Link>
        <h1 className="mt-3 text-4xl font-semibold">Edit media</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[#67564c]">
          Update the details for this media item.
        </p>

        <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
          <MediaItemForm
            action={updateMediaItem}
            communityId={id}
            returnTo={`/leader/communities/${id}/media`}
            submitLabel="Save changes"
            item={item}
          />
        </div>
      </div>
    </section>
  );
}
