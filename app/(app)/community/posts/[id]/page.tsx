import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createOpenCommunityComment,
  deleteOpenCommunityComment,
  deleteOpenCommunityPost,
  getOpenCommunityPost,
} from "@/app/actions/community-posts";
import { CommunityPostDisplay } from "@/components/community/community-post-display";

type CommunityPostPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function CommunityPostPage({ params, searchParams }: CommunityPostPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getOpenCommunityPost(id);

  if (!data.community || !data.post) {
    notFound();
  }

  const returnTo = `/community/posts/${id}`;

  return (
    <section className="px-6 py-10 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/community" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to community
        </Link>

        {query.message ? (
          <div className="mt-6 rounded-xl border border-[#ead6c5] bg-white/80 p-4 text-sm text-[#67564c]">
            {query.message}
          </div>
        ) : null}

        <div className="mt-8 space-y-3">
          <CommunityPostDisplay post={data.post} />
          {data.post.can_delete ? (
            <form action={deleteOpenCommunityPost}>
              <input type="hidden" name="post_id" value={data.post.id} />
              <input type="hidden" name="return_to" value="/community" />
              <button type="submit" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
                Delete post
              </button>
            </form>
          ) : null}
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Comments</h2>
          <div className="mt-5 space-y-4">
            {data.comments.length === 0 ? (
              <p className="rounded-2xl border border-[#ead6c5] bg-white/75 p-5 text-[#67564c]">No comments yet.</p>
            ) : (
              data.comments.map((comment) => (
                <article key={comment.id} className="rounded-2xl border border-[#ead6c5] bg-white/75 p-5 shadow-sm">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#ffe2cb] text-sm font-semibold text-[#8a3f1e]">
                        {comment.author_avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={comment.author_avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (comment.author_name || "Member").slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#3b312b]">{comment.author_name || "Member"}</p>
                        <p className="mt-1 text-xs text-[#8a7467]">
                          {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.created_at))}
                          {Math.abs(new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime()) > 1000 ? " - edited" : ""}
                        </p>
                      </div>
                    </div>
                    {comment.can_delete ? (
                      <form action={deleteOpenCommunityComment}>
                        <input type="hidden" name="comment_id" value={comment.id} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <button type="submit" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
                          Delete
                        </button>
                      </form>
                    ) : null}
                  </div>
                  <p className="mt-4 whitespace-pre-wrap leading-7 text-[#3b312b]">{comment.body}</p>
                </article>
              ))
            )}
          </div>

          {data.isSignedIn ? (
            <form action={createOpenCommunityComment} className="mt-6 rounded-2xl border border-[#ead6c5] bg-white/75 p-5 shadow-sm">
              <input type="hidden" name="post_id" value={id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Add a comment</span>
                <textarea
                  name="body"
                  rows={4}
                  maxLength={5000}
                  className="mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10"
                  required
                />
              </label>
              <button type="submit" className="mt-4 rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
                Comment
              </button>
            </form>
          ) : (
            <Link href="/signin" className="mt-6 inline-flex rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
              Sign in to comment
            </Link>
          )}
        </section>
      </div>
    </section>
  );
}
