import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCommunityPost, getCommunityPostsForLeader } from "@/app/actions/community-posts";
import { CommunityPostDisplay } from "@/components/community/community-post-display";

type LeaderCommunityUpdatesPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeaderCommunityUpdatesPage({ params }: LeaderCommunityUpdatesPageProps) {
  const { id } = await params;
  const data = await getCommunityPostsForLeader(id);

  if (!data.community) {
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
            <h1 className="mt-3 text-4xl font-semibold">Community updates</h1>
            <p className="mt-3 max-w-2xl leading-7 text-[#67564c]">
              Publish official updates, links, images, and videos for {data.community.name}.
            </p>
          </div>
          <Link
            href={`/leader/communities/${id}/updates/new`}
            className="inline-flex items-center justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
          >
            New update
          </Link>
        </div>

        <div className="mt-10 grid gap-5">
          {data.posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
              <h2 className="text-2xl font-semibold">No updates yet</h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
                Share the first official announcement, image, video, or link for this community.
              </p>
            </div>
          ) : (
            data.posts.map((post) => (
              <div key={post.id} className="space-y-3">
                <CommunityPostDisplay post={post} editHref={`/leader/communities/${id}/updates/${post.id}/edit`} />
                <form action={deleteCommunityPost} className="flex flex-col gap-3 sm:flex-row">
                  <input type="hidden" name="post_id" value={post.id} />
                  <input type="hidden" name="community_id" value={id} />
                  <input type="hidden" name="return_to" value={`/leader/communities/${id}/updates`} />
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
                </form>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
