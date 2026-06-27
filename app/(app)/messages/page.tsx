import { Archive, Inbox, MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { archiveConversation, getConversations, unarchiveConversation } from "@/app/actions/messages";
import { ActionButton, Badge, ContentCard, EmptyState, FormNotice, PageContainer, PageHeader, SearchInput } from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";

type MessagesPageProps = {
  searchParams: Promise<{
    message?: string;
    q?: string;
    view?: string;
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
  const params = await searchParams;
  const view = params.view === "archived" ? "archived" : "active";
  const conversations = await getConversations({ search: params.q || "", view });

  return (
    <PageContainer>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="Messages"
          title="Direct messages"
          description="Private one-on-one conversations with people on Selah Ember."
          action={<ActionButton href="/messages/new"><Plus aria-hidden="true" className="h-4 w-4" />New message</ActionButton>}
        />

        {params.message ? (
          <FormNotice className="mt-6">{params.message}</FormNotice>
        ) : null}

        <ContentCard as="section" className="mt-8 bg-white/70">
          <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <input type="hidden" name="view" value={view} />
            <SearchInput name="q" defaultValue={params.q || ""} label="Search conversations" placeholder="Search conversations" />
            <ActionButton type="submit">Search</ActionButton>
          </form>
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton href={`/messages${params.q ? `?q=${encodeURIComponent(params.q)}` : ""}`} variant={view === "active" ? "primary" : "secondary"} size="sm"><Inbox aria-hidden="true" className="h-4 w-4" />Active</ActionButton>
            <ActionButton href={`/messages?view=archived${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`} variant={view === "archived" ? "primary" : "secondary"} size="sm"><Archive aria-hidden="true" className="h-4 w-4" />Archived</ActionButton>
          </div>
        </ContentCard>

        {conversations.length === 0 ? (
          <EmptyState
            className="mt-10"
            icon={MessageCircle}
            title={view === "archived" ? "No archived conversations" : "No messages yet"}
            description={view === "archived" ? "Archived conversations will appear here." : "Start a direct conversation when you need to follow up privately."}
            action={view === "active" ? <ActionButton href="/messages/new">Start a conversation</ActionButton> : undefined}
          />
        ) : (
          <div className="mt-10 space-y-4">
            {conversations.map((conversation) => (
              <ContentCard key={conversation.id} className="bg-white/70">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/messages/${conversation.id}`} className="text-xl font-semibold hover:text-[#b94f22]">
                        {conversationTitle(
                          conversation.participants.filter(
                            (participant) => participant.user_id !== conversation.current_user_id,
                          ),
                        )}
                      </Link>
                      {conversation.unread_count > 0 ? (
                        <Badge tone="solid">{conversation.unread_count} unread</Badge>
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
                <div className="mt-4 flex flex-wrap gap-3 border-t border-[#ead6c5] pt-4">
                  <ActionButton href={`/messages/${conversation.id}`} variant="secondary" size="sm">Open</ActionButton>
                  <form action={view === "archived" ? unarchiveConversation : archiveConversation}>
                    <input type="hidden" name="conversation_id" value={conversation.id} />
                    <SubmitButton variant="secondary" pendingLabel={view === "archived" ? "Restoring…" : "Archiving…"} className="px-4 py-2">
                      {view === "archived" ? "Unarchive" : "Archive"}
                    </SubmitButton>
                  </form>
                </div>
              </ContentCard>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
