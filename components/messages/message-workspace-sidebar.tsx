import Link from "next/link";
import { Archive, ArchiveRestore, Inbox, MessageSquareText, Plus, Search } from "lucide-react";
import { archiveConversation, unarchiveConversation, type ConversationSummary } from "@/app/actions/messages";
import { cn } from "@/lib/utils/cn";

type Props = {
  conversations: ConversationSummary[];
  activeId?: string;
  view?: "active" | "archived";
  query?: string;
};

function titleFor(conversation: ConversationSummary) {
  return conversation.participants
    .filter((person) => person.user_id !== conversation.current_user_id)
    .map((person) => person.display_name)
    .filter(Boolean)
    .join(", ") || "Conversation";
}

function timeFor(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

export function MessageWorkspaceSidebar({ conversations, activeId, view = "active", query = "" }: Readonly<Props>) {
  return (
    <aside aria-label="Your conversations" className="flex min-h-0 flex-col border-r border-[#ead6c5] bg-[#f5e9dc]">
      <div className="border-b border-[#e6cbb6] p-4">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#9b4d25]">Selah Ember</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-[#211814]">Messages</h1>
          </div>
          <Link href="/messages/new" aria-label="New message" title="New message" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#a94720] text-white transition hover:bg-[#8d3818]">
            <Plus aria-hidden="true" className="h-5 w-5" />
          </Link>
        </div>
        <form action="/messages" method="get" role="search" className="flex items-center gap-2 rounded-xl border border-[#dec8b5] bg-white/90 px-3">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[#8a7367]" />
          <label htmlFor="conversation-search" className="sr-only">Search conversations</label>
          <input id="conversation-search" type="search" name="q" defaultValue={query} placeholder="Search conversations" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-[#211814] outline-none placeholder:text-[#8a7367]" />
          <input type="hidden" name="view" value={view} />
          <button type="submit" className="rounded-md px-2 py-1 text-xs font-semibold text-[#8a3f1e] hover:bg-[#fff1e3]">Go</button>
        </form>
        <div className="mt-3 flex gap-2 text-sm" role="navigation" aria-label="Message folders">
          <Link href={`/messages${query ? `?q=${encodeURIComponent(query)}` : ""}`} aria-current={view === "active" ? "page" : undefined} className={cn("flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg font-semibold transition", view === "active" ? "bg-white text-[#8a3f1e] shadow-sm" : "text-[#67564c] hover:bg-white/60")}>
            <Inbox aria-hidden="true" className="h-4 w-4" /> Chats
          </Link>
          <Link href={`/messages?view=archived${query ? `&q=${encodeURIComponent(query)}` : ""}`} aria-current={view === "archived" ? "page" : undefined} className={cn("flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg font-semibold transition", view === "archived" ? "bg-white text-[#8a3f1e] shadow-sm" : "text-[#67564c] hover:bg-white/60")}>
            <Archive aria-hidden="true" className="h-4 w-4" /> Archived
          </Link>
        </div>
      </div>
      <nav aria-label="Conversation list" className="max-h-[70svh] min-h-0 flex-1 space-y-1 overflow-y-auto p-2 lg:max-h-none">
        {conversations.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <MessageSquareText aria-hidden="true" className="mx-auto h-8 w-8 text-[#a4775c]" />
            <p className="mt-3 text-sm font-semibold">No conversations here</p>
            <p className="mt-1 text-xs leading-5 text-[#67564c]">Start a new message to connect with someone.</p>
          </div>
        ) : conversations.map((conversation) => {
          const title = titleFor(conversation);
          const selected = conversation.id === activeId;
          const other = conversation.participants.find((p) => p.user_id !== conversation.current_user_id);
          return (
            <div key={conversation.id} className={cn("group flex items-start gap-1 rounded-xl transition", selected ? "bg-white shadow-sm" : "hover:bg-white/70")}>
              <Link href={`/messages/${conversation.id}`} aria-current={selected ? "page" : undefined} className="flex min-w-0 flex-1 items-start gap-3 rounded-xl px-3 py-3 focus-visible:outline-[#a94720]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e7c7ac] text-sm font-bold text-[#7b3519]">
                  {other?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={other.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : title.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[#2c211b]">{title}</span>
                    <time className="shrink-0 text-[10px] text-[#8a7367]">{timeFor(conversation.updated_at)}</time>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-xs text-[#67564c]">{conversation.latest_message?.deleted_at ? "Message deleted" : conversation.latest_message?.body || "Start the conversation"}</p>
                    {conversation.unread_count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#a94720] px-1 text-[10px] font-bold text-white">{conversation.unread_count}</span>}
                  </div>
                </div>
              </Link>
              <form action={view === "archived" ? unarchiveConversation : archiveConversation} className="mr-2 mt-3 shrink-0">
                <input type="hidden" name="conversation_id" value={conversation.id} />
                <button type="submit" aria-label={`${view === "archived" ? "Unarchive" : "Archive"} ${title}`} title={view === "archived" ? "Unarchive conversation" : "Archive conversation"} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8a7367] transition hover:bg-[#ead5c3] hover:text-[#8a3f1e]">
                  {view === "archived" ? <ArchiveRestore aria-hidden="true" className="h-4 w-4" /> : <Archive aria-hidden="true" className="h-4 w-4" />}
                </button>
              </form>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-[#e6cbb6] p-3">
        <p className="text-center text-[11px] text-[#806a5f]">Private conversations with Selah Ember members</p>
      </div>
    </aside>
  );
}
