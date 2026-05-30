import Link from "next/link";
import { getPlatformConversationData } from "@/app/actions/platform";
import { SafeLink } from "@/components/media/safe-link";
import { MessageComposer } from "@/components/messages/message-composer";

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

function MessageBody({ body }: Readonly<{ body: string }>) {
  const urlPattern = /(https?:\/\/[^\s<>"']+)/g;
  const parts = body.split(urlPattern);

  return (
    <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-[#3b312b]">
      {parts.map((part, index) => {
        if (urlPattern.test(part)) {
          urlPattern.lastIndex = 0;
          return (
            <SafeLink key={`${part}-${index}`} href={part} className="font-semibold text-[#8a3f1e] underline">
              {part}
            </SafeLink>
          );
        }

        urlPattern.lastIndex = 0;
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </p>
  );
}

function MessageAttachments({
  attachments,
}: Readonly<{
  attachments: NonNullable<Awaited<ReturnType<typeof getPlatformConversationData>>["conversation"]>["messages"][number]["attachments"];
}>) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {attachments.map((attachment) => {
        if (attachment.kind === "image") {
          return attachment.signed_url ? (
            <img
              key={attachment.id}
              src={attachment.signed_url}
              alt={attachment.filename || "Message image"}
              className="max-h-[28rem] max-w-full rounded-xl border border-[#ead6c5] object-contain"
            />
          ) : (
            <p key={attachment.id} className="text-sm text-[#67564c]">
              Image unavailable.
            </p>
          );
        }

        if (attachment.kind === "video") {
          return attachment.signed_url ? (
            <video
              key={attachment.id}
              src={attachment.signed_url}
              controls
              preload="metadata"
              className="max-h-[28rem] max-w-full rounded-xl border border-[#ead6c5]"
            />
          ) : (
            <p key={attachment.id} className="text-sm text-[#67564c]">
              Video unavailable.
            </p>
          );
        }

        return (
          <SafeLink
            key={attachment.id}
            href={attachment.url}
            className="inline-flex break-all rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
          >
            {attachment.filename || attachment.url}
          </SafeLink>
        );
      })}
    </div>
  );
}

function ConversationUnavailable() {
  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/platform/messages" className="text-sm font-semibold text-[#8a3f1e] transition hover:text-[#cf5f2b]">
          Back to platform messages
        </Link>
        <div className="mt-8 rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
            Platform Messages
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Conversation unavailable</h1>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-[#67564c]">
            This support conversation may have been removed, or this platform account may not be a participant.
          </p>
        </div>
      </div>
    </section>
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
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <Link href="/platform/messages" className="text-sm font-semibold text-[#8a3f1e] transition hover:text-[#cf5f2b]">
          Back to platform messages
        </Link>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            <div className="rounded-2xl border border-[#ead6c5] bg-white/70 p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
                Support Conversation
              </p>
              <h1 className="mt-3 text-3xl font-semibold">{targetName}</h1>
              <p className="mt-3 break-words text-sm text-[#67564c]">
                Conversation ID: {conversation.id}
              </p>
            </div>

            {query.message ? (
              <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
                {query.message}
              </p>
            ) : null}

            <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/70 p-5 shadow-sm">
              {conversation.messages.length === 0 ? (
                <div className="py-10 text-center">
                  <h2 className="text-2xl font-semibold">No messages yet</h2>
                  <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
                    Send the first support message to this user.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversation.messages.map((message) => {
                    const sender = conversation.participants.find(
                      (participant) => participant.user_id === message.sender_id,
                    );

                    return (
                      <article key={message.id} className="rounded-xl border border-[#ead6c5] bg-white p-4">
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                          <p className="font-semibold">{sender?.display_name || "Selah Ember Member"}</p>
                          <p className="text-sm text-[#8a3f1e]">{formatDate(message.created_at)}</p>
                        </div>
                        <MessageBody body={message.deleted_at ? "Message deleted" : message.body} />
                        {!message.deleted_at ? <MessageAttachments attachments={message.attachments} /> : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <MessageComposer conversationId={conversation.id} returnTo={`/platform/messages/${conversation.id}`} />
          </div>

          <aside className="rounded-2xl border border-[#ead6c5] bg-white/70 p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-2xl font-semibold">User context</h2>
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
                  <dd className="mt-1 text-[#67564c]">
                    {targetUser.active_ban
                      ? `Banned until ${formatDate(targetUser.active_ban.expires_at)}`
                      : "No active ban"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-[#67564c]">Profile context unavailable.</p>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
