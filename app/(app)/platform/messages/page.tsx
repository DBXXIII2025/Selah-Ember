import { MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { getPlatformMessagesData, startPlatformSupportConversation } from "@/app/actions/platform";

type PlatformMessagesPageProps = {
  searchParams: Promise<{
    q?: string;
    message?: string;
  }>;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function conversationTitle(conversation: Awaited<ReturnType<typeof getPlatformMessagesData>>["conversations"][number]) {
  const others = conversation.participants.filter(
    (participant) => participant.user_id !== conversation.current_user_id,
  );

  return others.map((participant) => participant.display_name).join(", ") || "Direct message";
}

export default async function PlatformMessagesPage({ searchParams }: PlatformMessagesPageProps) {
  const params = await searchParams;
  const data = await getPlatformMessagesData(params.q || "");

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <Link href="/platform" className="text-sm font-semibold text-[#8a3f1e] transition hover:text-[#cf5f2b]">
          Back to platform
        </Link>
        <div className="mt-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
              Platform Messages
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Support conversations</h1>
            <p className="mt-4 max-w-3xl leading-7 text-[#67564c]">
              Message users directly while keeping the normal user inbox and notifications intact.
            </p>
          </div>
        </div>

        {params.message ? (
          <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
            {params.message}
          </p>
        ) : null}

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="rounded-2xl border border-[#ead6c5] bg-white/70 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <MessageCircle aria-hidden="true" className="h-5 w-5 text-[#b94f22]" />
              <h2 className="text-2xl font-semibold">Inbox</h2>
            </div>
            {data.conversations.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-8 text-center">
                <h3 className="text-xl font-semibold">No support conversations yet</h3>
                <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
                  Search for a user and start the first conversation.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {data.conversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/platform/messages/${conversation.id}`}
                    className="block rounded-2xl border border-[#ead6c5] bg-white/75 p-5 shadow-sm transition hover:border-[#d79568] hover:bg-white"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-semibold">{conversationTitle(conversation)}</h3>
                          {conversation.unread_count > 0 ? (
                            <span className="rounded-full bg-[#cf5f2b] px-3 py-1 text-xs font-semibold text-white">
                              {conversation.unread_count} unread
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-[#67564c]">
                          {conversation.latest_message
                            ? conversation.latest_message.deleted_at
                              ? "Message deleted"
                              : conversation.latest_message.body
                            : "No messages yet"}
                        </p>
                      </div>
                      <p className="text-sm text-[#8a3f1e]">{formatDate(conversation.updated_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-[#ead6c5] bg-white/70 p-5 shadow-sm">
            <h2 className="text-2xl font-semibold">Start conversation</h2>
            <form className="mt-5">
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Search users</span>
                <div className="relative">
                  <input name="q" type="search" defaultValue={params.q || ""} className={`${inputClassName} pr-12`} />
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

            <div className="mt-6 space-y-3">
              {data.users.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#d79568] bg-white/65 p-4 text-sm text-[#67564c]">
                  No users found.
                </p>
              ) : (
                data.users.map((user) => (
                  <article key={user.user_id} className="rounded-xl border border-[#ead6c5] bg-white/80 p-4 text-sm">
                    <p className="font-semibold">{user.display_name}</p>
                    <p className="mt-1 break-words text-[#67564c]">
                      {user.username ? `@${user.username}` : "No username"}
                      {user.email ? ` - ${user.email}` : ""}
                    </p>
                    <p className="mt-1 text-[#8a3f1e]">
                      {user.role}
                      {user.active_ban ? " - banned" : ""}
                    </p>
                    <form action={startPlatformSupportConversation} className="mt-3">
                      <input type="hidden" name="target_user_id" value={user.user_id} />
                      <button
                        type="submit"
                        className="rounded-full bg-[#cf5f2b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b94f22]"
                      >
                        Message
                      </button>
                    </form>
                  </article>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
