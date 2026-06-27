import { getPlatformConversationData } from "@/app/actions/platform";
import { MessageComposer } from "@/components/messages/message-composer";
import { MessageDisplay } from "@/components/messages/message-display";
import { MessageReactions } from "@/components/messages/message-reactions";
import { PlatformConversationToolsMenu } from "@/components/messages/platform-conversation-tools-menu";
import { Badge, ContentCard, DetailHeader, EmptyState, FormNotice, PageContainer, SectionHeader } from "@/components/ui/app-ui";

type PlatformConversationPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    message?: string;
  }>;
};

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

function ConversationUnavailable() {
  return (
    <PageContainer size="medium">
      <DetailHeader backHref="/platform/messages" backLabel="Back to platform messages" eyebrow="Platform messages" title="Conversation unavailable" />
      <EmptyState className="mt-8" title="This support conversation cannot be opened" description="It may have been removed, or this platform account may not be a participant." />
    </PageContainer>
  );
}

export default async function PlatformConversationPage({ params, searchParams }: PlatformConversationPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { conversation, targetUser } = await getPlatformConversationData(id);

  if (!conversation) {
    return <ConversationUnavailable />;
  }

  const targetName = targetUser?.display_name || "Selah Ember Member";

  return (
    <PageContainer>
      <div className="mx-auto max-w-6xl">
        <DetailHeader
          backHref="/platform/messages"
          backLabel="Back to platform messages"
          eyebrow="Support conversation"
          title={targetName}
          description={<span className="break-words text-sm">Conversation ID: {conversation.id}</span>}
          action={<PlatformConversationToolsMenu />}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            {query.message ? (
              <FormNotice>{query.message}</FormNotice>
            ) : null}

            <ContentCard as="section" className={`${query.message ? "mt-6" : ""} bg-white/60 p-4 sm:p-5`}>
              {conversation.messages.length === 0 ? (
                <EmptyState title="No messages yet" description="Send the first support message to this user." />
              ) : (
                <div className="space-y-3">
                  {conversation.messages.map((message) => {
                    const sender = conversation.participants.find(
                      (participant) => participant.user_id === message.sender_id,
                    );

                    return (
                      <MessageDisplay
                        key={message.id}
                        senderName={sender?.display_name || "Selah Ember Member"}
                        timestamp={formatDate(message.created_at)}
                        body={message.body}
                        attachments={message.attachments}
                        isOwn={message.sender_id === conversation.current_user_id}
                        deleted={Boolean(message.deleted_at)}
                      >
                          <MessageReactions
                            conversationId={conversation.id}
                            currentUserId={conversation.current_user_id}
                            messageId={message.id}
                            reactions={message.reactions}
                            returnTo={`/platform/messages/${conversation.id}`}
                          />
                      </MessageDisplay>
                    );
                  })}
                </div>
              )}
            </ContentCard>

            <MessageComposer conversationId={conversation.id} returnTo={`/platform/messages/${conversation.id}`} />
          </div>

          <ContentCard as="section" className="bg-white/70 lg:sticky lg:top-6 lg:self-start">
            <SectionHeader title="User context" />
            {targetUser ? (
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="font-semibold text-[#3b312b]">Profile</dt>
                  <dd className="mt-1 break-words text-[#67564c]">
                    {targetUser.display_name}
                    {targetUser.username ? ` - @${targetUser.username}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#3b312b]">Email</dt>
                  <dd className="mt-1 break-words text-[#67564c]">{targetUser.email || "Unavailable"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#3b312b]">Role</dt>
                  <dd className="mt-1 text-[#67564c]">{targetUser.role}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#3b312b]">Joined</dt>
                  <dd className="mt-1 text-[#67564c]">{formatDate(targetUser.created_at)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#3b312b]">Ban status</dt>
                  <dd className="mt-2"><Badge tone={targetUser.active_ban ? "ember" : "success"}>{targetUser.active_ban ? `Banned until ${formatDate(targetUser.active_ban.expires_at)}` : "No active ban"}</Badge></dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-[#67564c]">Profile context unavailable.</p>
            )}
          </ContentCard>
        </div>
      </div>
    </PageContainer>
  );
}
