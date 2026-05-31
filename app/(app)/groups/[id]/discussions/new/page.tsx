import Link from "next/link";
import { notFound } from "next/navigation";
import { createGroupThread, getGroupThreads } from "@/app/actions/discussions";

type NewGroupDiscussionPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

export default async function NewGroupDiscussionPage({ params, searchParams }: NewGroupDiscussionPageProps) {
  const { id } = await params;
  const { message } = await searchParams;
  const data = await getGroupThreads(id);

  if (!data.group) {
    notFound();
  }

  const group = data.group;

  if (!data.isMember) {
    return (
      <section className="px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#ead6c5] bg-white/75 p-8 text-center shadow-sm">
          <h1 className="text-3xl font-semibold">Join to start a discussion</h1>
          <p className="mt-3 text-[#67564c]">Group discussions are private to members.</p>
          <Link href={`/groups/${group.id}/discussions`} className="mt-6 inline-flex text-sm font-semibold text-[#8a3f1e]">
            Back to discussions
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <Link href={`/groups/${group.id}/discussions`} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to discussions
        </Link>
        <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">New group thread</p>
          <h1 className="mt-3 text-4xl font-semibold">{group.title}</h1>
          {message ? (
            <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
              {message}
            </p>
          ) : null}
          <form action={createGroupThread} className="mt-8 space-y-5">
            <input type="hidden" name="group_id" value={group.id} />
            <label className="block">
              <span className="text-sm font-medium text-[#3b312b]">Title</span>
              <input name="title" required maxLength={160} className={inputClassName} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#3b312b]">Body</span>
              <textarea name="body" required maxLength={10000} rows={8} className={inputClassName} />
            </label>
            <button type="submit" className="rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
              Create thread
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
