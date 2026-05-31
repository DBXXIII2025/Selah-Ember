import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteMediaItem, getOwnedCommunityMediaForLeader } from "@/app/actions/media";
import { MediaItemDisplay } from "@/components/media/media-item-display";

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
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link href={`/leader/communities/${id}`} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
              Back to community management
            </Link>
            <h1 className="mt-3 text-4xl font-semibold">Media library</h1>
            <p className="mt-3 max-w-2xl leading-7 text-[#67564c]">
              Manage sermons, teachings, notes, and resource links for {media.community.name}.
            </p>
          </div>
          <Link
            href={`/leader/communities/${id}/media/new`}
            className="inline-flex items-center justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
          >
            Add media
          </Link>
        </div>

        <div className="mt-10 grid gap-5">
          {media.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
              <h2 className="text-2xl font-semibold">No media yet</h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
                Add your first sermon, teaching, or resource link to build the community library.
              </p>
            </div>
          ) : (
            media.items.map((item) => (
              <div key={item.id} className="space-y-3">
                <MediaItemDisplay item={item} href={`/leader/communities/${id}/media/${item.id}/edit`} compact />
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/leader/communities/${id}/media/${item.id}/edit`}
                    className="rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
                  >
                    Edit
                  </Link>
                  <form action={deleteMediaItem}>
                    <input type="hidden" name="media_id" value={item.id} />
                    <input type="hidden" name="return_to" value={`/leader/communities/${id}/media`} />
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        name="confirmation"
                        type="text"
                        placeholder="DELETE"
                        className="rounded-xl border border-[#ead6c5] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10"
                      />
                      <button
                        type="submit"
                        className="rounded-full border border-[#b42318]/30 bg-white px-4 py-2 text-sm font-semibold text-[#b42318] transition hover:bg-[#fff1f0]"
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
