import { Search } from "lucide-react";
import Link from "next/link";
import { searchMessageUsers, startDirectConversation } from "@/app/actions/messages";

type NewMessagePageProps = {
  searchParams: Promise<{
    q?: string;
    message?: string;
  }>;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

export default async function NewMessagePage({ searchParams }: NewMessagePageProps) {
  const params = await searchParams;
  const users = await searchMessageUsers(params.q || "");

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/messages" className="text-sm font-semibold text-[#8a3f1e] transition hover:text-[#cf5f2b]">
          Back to messages
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
          New message
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Choose a person</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
          Search visible profiles and start a private one-on-one conversation.
        </p>

        {params.message ? (
          <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
            {params.message}
          </p>
        ) : null}

        <form className="mt-10 rounded-2xl border border-[#ead6c5] bg-white/70 p-5 shadow-sm">
          <label className="block">
            <span className="text-sm font-medium text-[#3b312b]">Search people</span>
            <div className="relative">
              <input
                name="q"
                type="search"
                defaultValue={params.q || ""}
                className={`${inputClassName} pr-12`}
              />
              <Search aria-hidden="true" className="absolute right-4 top-5 h-5 w-5 text-[#8a3f1e]" />
            </div>
          </label>
          <button
            type="submit"
            className="mt-4 rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
          >
            Search
          </button>
        </form>

        <div className="mt-8 space-y-4">
          {users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-8 text-center">
              <h2 className="text-2xl font-semibold">No people found</h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
                Try a display name, username, or church name.
              </p>
            </div>
          ) : (
            users.map((user) => (
              <article key={user.user_id} className="rounded-2xl border border-[#ead6c5] bg-white/70 p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-xl font-semibold">{user.display_name}</h2>
                    <p className="mt-1 text-sm text-[#67564c]">
                      {user.username ? `@${user.username}` : "No username"}
                      {user.church_name ? ` - ${user.church_name}` : ""}
                    </p>
                  </div>
                  <form action={startDirectConversation}>
                    <input type="hidden" name="target_user_id" value={user.user_id} />
                    <button
                      type="submit"
                      className="rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b94f22]"
                    >
                      Message
                    </button>
                  </form>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
