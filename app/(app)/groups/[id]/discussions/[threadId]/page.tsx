import { Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createDiscussionReply,
  deleteOwnReply,
  deleteOwnThread,
  getDiscussionThread,
  getGroupThreads,
  reportDiscussionReply,
  reportDiscussionThread,
} from "@/app/actions/discussions";
import { DiscussionBody } from "@/components/discussions/discussion-body";

type GroupDiscussionThreadPageProps = {
  params: Promise<{ id: string; threadId: string }>;
  searchParams: Promise<{ message?: string }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function GroupDiscussionThreadPage({ params, searchParams }: GroupDiscussionThreadPageProps) {
  const { id, threadId } = await params;
  const { message } = await searchParams;
  const [groupData, threadData] = await Promise.all([getGroupThreads(id), getDiscussionThread(threadId)]);
  const thread = threadData.thread;

  if (!groupData.group) {
    notFound();
  }

  if (!thread || thread.group_id !== id) {
    return (
      <section className="px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#ead6c5] bg-white/75 p-8 text-center shadow-sm">
          <h1 className="text-3xl font-semibold">Discussion unavailable</h1>
          <p className="mt-3 text-[#67564c]">This thread may have moved, or you may need to join the group to view it.</p>
          <Link href={`/groups/${id}/discussions`} className="mt-6 inline-flex text-sm font-semibold text-[#8a3f1e]">
            Back to discussions
          </Link>
        </div>
      </section>
    );
  }

  const returnPath = `/groups/${id}/discussions/${threadId}`;
  const canManageThread =
    thread.author_id === threadData.current_user_id ||
    threadData.current_user_role === "platform_engineer" ||
    threadData.role === "owner" ||
    threadData.role === "leader";
  const canManageReply =
    threadData.current_user_role === "platform_engineer" ||
    threadData.role === "owner" ||
    threadData.role === "leader";

  const canReply = threadData.isMember && !thread.deleted_at;

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <Link href={`/groups/${id}/discussions`} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to discussions
        </Link>
        {message ? (
          <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
            {message}
          </p>
        ) : null}

        <article className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">Group thread</p>
              <h1 className="mt-3 text-4xl font-semibold">{thread.deleted_at ? "Thread deleted" : thread.title}</h1>
              <p className="mt-3 text-sm text-[#8a7467]">
                {thread.author.display_name} · {formatDate(thread.created_at)}
              </p>
            </div>
            {!thread.deleted_at ? (
              <form action={reportDiscussionThread}>
                <input type="hidden" name="thread_id" value={thread.id} />
                <input type="hidden" name="reason" value="Concern" />
                <input type="hidden" name="return_path" value={returnPath} />
                <button type="submit" className="rounded-full border border-[#ead6c5] bg-white px-4 py-2 text-sm font-semibold text-[#8a3f1e] hover:bg-[#fff4e8]">
                  Report
                </button>
              </form>
            ) : null}
          </div>

          <div className="mt-6">
            {thread.deleted_at ? <p className="italic text-[#67564c]">Thread deleted</p> : <DiscussionBody body={thread.body} />}
          </div>

          {!thread.deleted_at && canManageThread ? (
            <form action={deleteOwnThread} className="mt-6">
              <input type="hidden" name="thread_id" value={thread.id} />
              <input type="hidden" name="return_path" value={returnPath} />
              <button type="submit" className="inline-flex items-center gap-2 rounded-full border border-[#b42318]/30 bg-white px-4 py-2 text-sm font-semibold text-[#b42318] hover:bg-[#fff1f0]">
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Delete thread
              </button>
            </form>
          ) : null}
        </article>

        <div className="mt-8 space-y-4">
          <h2 className="text-2xl font-semibold">Replies</h2>
          {thread.replies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d9b99d] bg-white/60 p-6 text-[#67564c]">
              No replies yet.
            </div>
          ) : (
            thread.replies.map((reply) => (
              <article key={reply.id} className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <p className="text-sm font-semibold text-[#8a3f1e]">
                    {reply.author.display_name} · <span className="font-normal text-[#8a7467]">{formatDate(reply.created_at)}</span>
                  </p>
                  {!reply.deleted_at ? (
                    <form action={reportDiscussionReply}>
                      <input type="hidden" name="reply_id" value={reply.id} />
                      <input type="hidden" name="reason" value="Concern" />
                      <input type="hidden" name="return_path" value={returnPath} />
                      <button type="submit" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
                        Report
                      </button>
                    </form>
                  ) : null}
                </div>
                <div className="mt-4">
                  {reply.deleted_at ? <p className="italic text-[#67564c]">Reply deleted</p> : <DiscussionBody body={reply.body} />}
                </div>
                {!reply.deleted_at && (reply.author_id === threadData.current_user_id || canManageReply) ? (
                  <form action={deleteOwnReply} className="mt-4">
                    <input type="hidden" name="reply_id" value={reply.id} />
                    <input type="hidden" name="return_path" value={returnPath} />
                    <button type="submit" className="text-sm font-semibold text-[#b42318] hover:text-[#8a1f16]">
                      Delete reply
                    </button>
                  </form>
                ) : null}
              </article>
            ))
          )}
        </div>

        {canReply ? (
          <form action={createDiscussionReply} className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <input type="hidden" name="thread_id" value={thread.id} />
            <input type="hidden" name="return_path" value={returnPath} />
            <label className="block">
              <span className="text-sm font-medium text-[#3b312b]">Reply</span>
              <textarea
                name="body"
                required
                maxLength={10000}
                rows={5}
                className="mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10"
              />
            </label>
            <button type="submit" className="mt-4 rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
              Reply
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
