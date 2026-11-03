import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { deleteOwnMessage, getConversation, getConversations, markConversationRead } from "@/app/actions/messages";
import { ConversationToolsMenu } from "@/components/messages/conversation-tools-menu";
import { MessageComposer } from "@/components/messages/message-composer";
import { MessageDisplay } from "@/components/messages/message-display";
import { MessageReactions } from "@/components/messages/message-reactions";
import { MessageWorkspaceSidebar } from "@/components/messages/message-workspace-sidebar";
import { MessageScrollRegion } from "@/components/messages/message-scroll-region";
import { ActionButton, DetailHeader, EmptyState, FormNotice, PageContainer } from "@/components/ui/app-ui";

type ConversationPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
};

function formatMessageDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function ConversationPage({ params, searchParams }: ConversationPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [conversation, conversations] = await Promise.all([getConversation(id), getConversations()]);

  if (!conversation) {
    return (
      <PageContainer size="medium">
        <DetailHeader backHref="/messages" backLabel="Go back to Messages" eyebrow="Messages" title="Conversation unavailable" />
        <EmptyState className="mt-8" title="This conversation cannot be opened" description="It may have been removed, or your account may not have access to it." />
      </PageContainer>
    );
  }

  await markConversationRead(id);
  const otherParticipants = conversation.participants.filter((p) => p.user_id !== conversation.current_user_id);
  const title = otherParticipants.map((p) => p.display_name).filter(Boolean).join(", ") || "Direct message";
  const otherParticipant = otherParticipants[0];
  const subtitle = otherParticipants.map((p) => p.username ? `@${p.username}` : "Selah Ember member").join(", ");

  return (
    <section aria-label="Message conversation" className="px-2 py-2 sm:px-5 sm:py-4 lg:px-8">
      <div className="mx-auto grid h-[calc(100svh-7rem)] min-h-[32rem] max-h-[60rem] max-w-[90rem] overflow-hidden rounded-2xl border border-[#e6cbb6] bg-[#fffdf9] shadow-[0_18px_55px_rgba(33,24,20,0.07)] lg:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="hidden min-h-0 lg:flex lg:flex-col">
          <MessageWorkspaceSidebar conversations={conversations} activeId={id} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-col">
          <header className="flex min-h-[4.5rem] shrink-0 items-center gap-3 border-b border-[#ead6c5] bg-white/85 px-3 py-3 sm:px-6">
            <Link href="/messages" aria-label="Back to messages" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#67564c] transition hover:bg-[#f5e9dc] lg:hidden">
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#ead1ba] text-sm font-bold text-[#8a3f1e]">
              {otherParticipant?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={otherParticipant.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : title.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold tracking-tight text-[#211814] sm:text-lg">{title}</h1>
              <p className="truncate text-xs text-[#806a5f]">{subtitle || "Private conversation"}</p>
            </div>
            <ConversationToolsMenu conversationId={conversation.id} otherParticipant={otherParticipant} />
          </header>
          {query.message ? <div className="px-4 pt-3"><FormNotice>{query.message}</FormNotice></div> : null}
          <MessageScrollRegion>
            {conversation.messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <MessageCircle aria-hidden="true" className="h-9 w-9 text-[#b98261]" />
                <h2 className="mt-3 text-lg font-semibold text-[#211814]">Start the conversation</h2>
                <p className="mt-1 text-sm text-[#67564c]">Say hello using the message box below.</p>
              </div>
            ) : conversation.messages.map((message) => {
              const sender = conversation.participants.find((p) => p.user_id === message.sender_id);
              return (
                <MessageDisplay
                  key={message.id}
                  senderName={message.sender_id ? sender?.display_name || "Selah Ember Member" : "Deleted user"}
                  timestamp={formatMessageDate(message.created_at)}
                  body={message.body}
                  attachments={message.attachments}
                  isOwn={message.sender_id === conversation.current_user_id}
                  deleted={Boolean(message.deleted_at)}
                  deliveryLabel={message.sender_id === conversation.current_user_id && !message.deleted_at ? (message.read_by_others ? "Read" : "Sent") : undefined}
                >
                  <MessageReactions conversationId={conversation.id} currentUserId={conversation.current_user_id} messageId={message.id} reactions={message.reactions} />
                  {message.sender_id === conversation.current_user_id ? (
                    <form action={deleteOwnMessage} className="mt-2">
                      <input type="hidden" name="conversation_id" value={conversation.id} />
                      <input type="hidden" name="message_id" value={message.id} />
                      <ActionButton type="submit" variant="quiet" size="sm">Delete message</ActionButton>
                    </form>
                  ) : null}
                </MessageDisplay>
              );
            })}
          </MessageScrollRegion>
          <div className="shrink-0 border-t border-[#ead6c5] bg-white/95 px-3 pb-3 pt-1 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <MessageComposer conversationId={conversation.id} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
