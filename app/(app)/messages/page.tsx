import { MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { getConversations } from "@/app/actions/messages";

type MessagesPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

function formatMessageDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function conversationTitle(participants: Awaited<ReturnType<typeof getConversations>>[number]["participants"]) {
  const others = participants.filter((participant) => participant.display_name);
  return others.map((participant) => participant.display_name).join(", ") || "Direct message";
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const [conversations, params] = await Promise.all([getConversations(), searchParams]);

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
              Messages
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Direct messages</h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
              Private one-on-one conversations with people on Selah Ember.
            </p>
          </div>
          <Link
            href="/messages/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            New message
          </Link>
        </div>

        {params.message ? (
          <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
            {params.message}
          </p>
        ) : null}

        {conversations.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
              <MessageCircle aria-hidden="true" className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold">No messages yet</h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
              Start a direct conversation when you need to follow up privately.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-4">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                className="block rounded-2xl border border-[#ead6c5] bg-white/70 p-5 shadow-sm transition hover:border-[#d79568] hover:bg-white"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold">
                        {conversationTitle(
                          conversation.participants.filter(
                            (participant) => participant.user_id !== conversation.current_user_id,
                          ),
                        )}
                      </h2>
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
                  <p className="text-sm text-[#8a3f1e]">{formatMessageDate(conversation.updated_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
