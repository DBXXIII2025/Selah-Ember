import {
  deleteOwnMessage,
  getConversation,
  markConversationRead,
} from "@/app/actions/messages";
import { ConversationToolsMenu } from "@/components/messages/conversation-tools-menu";
import { MessageComposer } from "@/components/messages/message-composer";
import { MessageDisplay } from "@/components/messages/message-display";
import { MessageReactions } from "@/components/messages/message-reactions";
import { ActionButton, ContentCard, DetailHeader, EmptyState, FormNotice, PageContainer } from "@/components/ui/app-ui";

type ConversationPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    message?: string;
  }>;
};

function formatMessageDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ConversationUnavailable() {
  return (
    <PageContainer size="medium">
      <DetailHeader backHref="/messages" backLabel="Back to messages" eyebrow="Messages" title="Conversation unavailable" />
      <EmptyState className="mt-8" title="This conversation cannot be opened" description="It may have been removed, or your account may not have access to it." />
    </PageContainer>
  );
}

export default async function ConversationPage({ params, searchParams }: ConversationPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const conversation = await getConversation(id);

  if (!conversation) {
    return <ConversationUnavailable />;
  }

  await markConversationRead(id);
  const title = conversation.participants.map((participant) => participant.display_name).join(", ") || "Direct message";
  const otherParticipant = conversation.participants.find(
    (participant) => participant.user_id !== conversation.current_user_id,
  );
  const participantLabels =
    conversation.participants
      .map((participant) => participant.username ? `@${participant.username}` : participant.user_id)
      .join(" - ") || "Participants unavailable";

  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref="/messages"
        backLabel="Back to messages"
        eyebrow="Conversation"
        title={title}
        description={<span className="break-words text-sm">{participantLabels}</span>}
        action={<ConversationToolsMenu conversationId={conversation.id} otherParticipant={otherParticipant} />}
      />

        {query.message ? (
          <FormNotice className="mt-6">{query.message}</FormNotice>
        ) : null}

        <ContentCard as="section" className="mt-8 bg-white/60 p-4 sm:p-5">
          {conversation.messages.length === 0 ? (
            <EmptyState title="No messages yet" description="Send the first message in this conversation." />
          ) : (
            <div className="space-y-3">
              {conversation.messages.map((message) => {
                const sender = conversation.participants.find((participant) => participant.user_id === message.sender_id);

                return (
                  <MessageDisplay
                    key={message.id}
                    senderName={sender?.display_name || "Selah Ember Member"}
                    timestamp={formatMessageDate(message.created_at)}
                    body={message.body}
                    attachments={message.attachments}
                    isOwn={message.sender_id === conversation.current_user_id}
                    deleted={Boolean(message.deleted_at)}
                    deliveryLabel={message.sender_id === conversation.current_user_id && !message.deleted_at ? (message.read_by_others ? "Read" : "Sent") : undefined}
                  >
                    <MessageReactions
                      conversationId={conversation.id}
                      currentUserId={conversation.current_user_id}
                      messageId={message.id}
                      reactions={message.reactions}
                    />
                    {message.sender_id === conversation.current_user_id ? (
                      <form action={deleteOwnMessage} className="mt-2">
                        <input type="hidden" name="conversation_id" value={conversation.id} />
                        <input type="hidden" name="message_id" value={message.id} />
                        <ActionButton type="submit" variant="quiet" size="sm" className="-ml-4">Delete message</ActionButton>
                      </form>
                    ) : null}
                  </MessageDisplay>
                );
              })}
            </div>
          )}
        </ContentCard>

        <MessageComposer conversationId={conversation.id} />
    </PageContainer>
  );
}
