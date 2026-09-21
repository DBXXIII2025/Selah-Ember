import { MessageSquareText, Plus } from "lucide-react";
import Link from "next/link";
import { getGroupThreads, toggleGroupThreadPin } from "@/app/actions/discussions";
import { BackToLink } from "@/components/ui/app-ui";

type GroupDiscussionsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; q?: string; member?: string; category?: string; sort?: string; page?: string }>;
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
  const query = await searchParams;
  const { message } = query;
  const data = await getGroupThreads(id, { ...query, page: Number(query.page) || 1 });
  const pageHref = (page: number) => `?${new URLSearchParams({ ...(query.q ? { q: query.q } : {}), ...(query.member ? { member: query.member } : {}), ...(query.category ? { category: query.category } : {}), ...(query.sort ? { sort: query.sort } : {}), page: String(page) })}`;
  const currentPath = `/groups/${id}/discussions${pageHref(data.page)}`;

  if (data.state === "missing") {
    return (
      <section className="px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#ead6c5] bg-white/75 p-8 text-center shadow-sm">
          <MessageSquareText aria-hidden="true" className="mx-auto h-10 w-10 text-[#b94f22]" />
          <h1 className="mt-4 text-3xl font-semibold">Group discussions unavailable</h1>
          <p className="mt-3 text-[#67564c]">This group could not be found.</p>
          <Link href="/groups" className="mt-6 inline-flex text-sm font-semibold text-[#8a3f1e]">
            Go back to Groups
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
            {data.group?.title ? `Go back to ${data.group.title}` : "Go back to group"}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <BackToLink href={`/groups/${group!.id}`} label={`Go back to ${group!.title}`} />

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
        {data.migrationRequired ? <p className="mt-4 rounded-xl bg-[#fff4e8] p-4 text-sm text-[#8a3f1e]">Migration 0047 is required for categories and pins. Discussions remain readable.</p> : null}
        {data.isMember ? <form className="mt-6 grid gap-3 rounded-2xl border border-[#ead6c5] bg-white/75 p-5 md:grid-cols-4"><label className="text-sm font-semibold">Keywords<input name="q" defaultValue={query.q} className="mt-2 w-full rounded-xl border border-[#d9b99d] px-3 py-2" /></label><label className="text-sm font-semibold">Member<input name="member" defaultValue={query.member} className="mt-2 w-full rounded-xl border border-[#d9b99d] px-3 py-2" /></label><label className="text-sm font-semibold">Category<select name="category" defaultValue={query.category || "all"} className="mt-2 w-full rounded-xl border border-[#d9b99d] px-3 py-2"><option value="all">All</option><option value="general">General</option><option value="bible_study">Bible Study</option><option value="question">Question</option><option value="prayer">Prayer</option><option value="testimony">Testimony</option><option value="fellowship">Fellowship</option><option value="announcement">Announcement</option></select></label><label className="text-sm font-semibold">Sort<select name="sort" defaultValue={query.sort || "active"} className="mt-2 w-full rounded-xl border border-[#d9b99d] px-3 py-2"><option value="active">Recently active</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label><div className="flex gap-3 md:col-span-4"><button className="rounded-full bg-[#a94720] px-5 py-2 font-semibold text-white">Apply filters</button><Link href={`/groups/${id}/discussions`} className="rounded-full border border-[#d9b99d] px-5 py-2 font-semibold text-[#67564c]">Clear filters</Link></div></form> : null}
        {data.isMember ? <p className="mt-6 text-sm text-[#67564c]">{data.total} {data.total === 1 ? "discussion" : "discussions"}</p> : null}

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
                    <div className="mb-2 flex flex-wrap gap-2"><span className="rounded-full bg-[#fff4e8] px-3 py-1 text-xs font-semibold capitalize text-[#8a3f1e]">{thread.category.replace("_", " ")}</span>{thread.is_pinned ? <span className="rounded-full bg-[#ffe2cb] px-3 py-1 text-xs font-semibold text-[#8a3f1e]">Pinned</span> : null}</div>
                    <Link
                      href={`/groups/${group!.id}/discussions/${thread.id}`}
                      className="text-2xl font-semibold hover:text-[#b94f22]"
                    >
                      {thread.deleted_at ? "Thread deleted" : thread.title}
                    </Link>
                    <p className="mt-2 text-sm text-[#715e54]">
                      <Link href={thread.author.profile_id ? `/members/${thread.author.profile_id}` : "#"} className="hover:text-[#a94720]">{thread.author.display_name}{thread.author.username ? ` (@${thread.author.username})` : ""}</Link> · updated {formatDate(thread.updated_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#fff4e8] px-3 py-1 text-sm font-semibold text-[#8a3f1e]">
                    {thread.reply_count} {thread.reply_count === 1 ? "reply" : "replies"}
                  </span>
                </div>
                <p className="mt-4 leading-7 text-[#67564c]">
                  {thread.deleted_at ? "Thread deleted" : previewBody(thread.body)}
                </p>
                {data.canPin && !data.migrationRequired ? <form action={toggleGroupThreadPin} className="mt-4"><input type="hidden" name="thread_id" value={thread.id}/><input type="hidden" name="group_id" value={group!.id}/><input type="hidden" name="return_path" value={currentPath}/><button className="text-sm font-semibold text-[#8a3f1e]">{thread.is_pinned ? "Unpin" : "Pin"} discussion</button></form> : null}
              </article>
            ))}
          </div>
        )}
        {data.isMember ? <nav aria-label="Discussion pages" className="mt-8 grid grid-cols-3 items-center"><div>{data.page > 1 ? <Link className="font-semibold text-[#8a3f1e]" href={pageHref(data.page - 1)}>Previous</Link> : null}</div><p className="text-center text-sm font-semibold text-[#67564c]">Page {data.page} of {data.pageCount}</p><div className="text-right">{data.page < data.pageCount ? <Link className="font-semibold text-[#8a3f1e]" href={pageHref(data.page + 1)}>Next</Link> : null}</div></nav> : null}
      </div>
    </section>
  );
}
