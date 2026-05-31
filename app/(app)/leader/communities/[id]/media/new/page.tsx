import Link from "next/link";
import { notFound } from "next/navigation";
import { createMediaItem, getOwnedCommunityMediaForLeader } from "@/app/actions/media";
import { MediaItemForm } from "@/components/media/media-item-form";

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
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <Link href={`/leader/communities/${id}/media`} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to media library
        </Link>
        <h1 className="mt-3 text-4xl font-semibold">Add media</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[#67564c]">
          Create a sermon, teaching, testimony, or resource for {media.community.name}.
        </p>

        <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
          <MediaItemForm
            action={createMediaItem}
            communityId={id}
            returnTo={`/leader/communities/${id}/media`}
            submitLabel="Create media item"
          />
        </div>
      </div>
    </section>
  );
}
