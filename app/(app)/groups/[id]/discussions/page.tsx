import { MessageSquareText, Plus } from "lucide-react";
import Link from "next/link";
import { getGroupThreads } from "@/app/actions/discussions";

type GroupDiscussionsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function previewBody(body: string) {
  const compact = body.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

export default async function GroupDiscussionsPage({ params, searchParams }: GroupDiscussionsPageProps) {
  const { id } = await params;
  const { message } = await searchParams;
  const data = await getGroupThreads(id);

  if (data.state === "missing") {
    return (
      <section className="px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#ead6c5] bg-white/75 p-8 text-center shadow-sm">
          <MessageSquareText aria-hidden="true" className="mx-auto h-10 w-10 text-[#b94f22]" />
          <h1 className="mt-4 text-3xl font-semibold">Group discussions unavailable</h1>
          <p className="mt-3 text-[#67564c]">This group could not be found.</p>
          <Link href="/groups" className="mt-6 inline-flex text-sm font-semibold text-[#8a3f1e]">
            Back to groups
          </Link>
        </div>
      </section>
    );
  }

  const group = data.group;

  if (data.state === "signed_out") {
    return (
      <section className="px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#ead6c5] bg-white/75 p-8 text-center shadow-sm">
          <MessageSquareText aria-hidden="true" className="mx-auto h-10 w-10 text-[#b94f22]" />
          <h1 className="mt-4 text-3xl font-semibold">Sign in to view discussions</h1>
          <p className="mt-3 text-[#67564c]">Group discussions are private to members.</p>
          <Link href="/signin" className="mt-6 inline-flex rounded-full bg-[#a94720] px-5 py-3 text-sm font-semibold text-white">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  if (data.state === "non_member") {
    return (
      <section className="px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#ead6c5] bg-white/75 p-8 text-center shadow-sm">
          <MessageSquareText aria-hidden="true" className="mx-auto h-10 w-10 text-[#b94f22]" />
          <h1 className="mt-4 text-3xl font-semibold">Join this group to view discussions</h1>
          <p className="mt-3 text-[#67564c]">Private study threads are visible only to group members.</p>
          <Link href={`/groups/${data.group?.id || id}`} className="mt-6 inline-flex text-sm font-semibold text-[#8a3f1e]">
            Back to group
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Link href={`/groups/${group!.id}`} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to group
        </Link>

        <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">Group discussions</p>
            <h1 className="mt-3 text-4xl font-semibold">{group!.title}</h1>
            <p className="mt-3 max-w-2xl leading-7 text-[#67564c]">
              Member-only threads for study notes, questions, prayer follow-up, and fellowship.
            </p>
          </div>
          {data.isMember ? (
            <Link
              href={`/groups/${group!.id}/discussions/new`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#a94720] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#a94720]/20 transition hover:bg-[#b94f22]"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              New thread
            </Link>
          ) : null}
        </div>

        {message ? (
          <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
            {message}
          </p>
        ) : null}

        {!data.isSignedIn ? (
          <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-8 text-center shadow-sm">
            <MessageSquareText aria-hidden="true" className="mx-auto h-10 w-10 text-[#b94f22]" />
            <h2 className="mt-4 text-2xl font-semibold">Sign in to view discussions</h2>
            <p className="mt-3 text-[#67564c]">Group discussions are private to members.</p>
            <Link href="/signin" className="mt-6 inline-flex rounded-full bg-[#a94720] px-5 py-3 text-sm font-semibold text-white">
              Sign in
            </Link>
          </div>
        ) : !data.isMember ? (
          <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-8 text-center shadow-sm">
            <MessageSquareText aria-hidden="true" className="mx-auto h-10 w-10 text-[#b94f22]" />
            <h2 className="mt-4 text-2xl font-semibold">Join to view discussions</h2>
            <p className="mt-3 text-[#67564c]">Private study threads are visible only to group members.</p>
          </div>
        ) : data.threads.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#d9b99d] bg-white/60 p-8 text-center">
            <MessageSquareText aria-hidden="true" className="mx-auto h-10 w-10 text-[#b94f22]" />
            <h2 className="mt-4 text-2xl font-semibold">No threads yet</h2>
            <p className="mt-3 text-[#67564c]">Start the first group conversation.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {data.threads.map((thread) => (
              <article key={thread.id} className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link
                      href={`/groups/${group!.id}/discussions/${thread.id}`}
                      className="text-2xl font-semibold hover:text-[#b94f22]"
                    >
                      {thread.deleted_at ? "Thread deleted" : thread.title}
                    </Link>
                    <p className="mt-2 text-sm text-[#715e54]">
                      {thread.author.display_name} · updated {formatDate(thread.updated_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#fff4e8] px-3 py-1 text-sm font-semibold text-[#8a3f1e]">
                    {thread.reply_count} {thread.reply_count === 1 ? "reply" : "replies"}
                  </span>
                </div>
                <p className="mt-4 leading-7 text-[#67564c]">
                  {thread.deleted_at ? "Thread deleted" : previewBody(thread.body)}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
