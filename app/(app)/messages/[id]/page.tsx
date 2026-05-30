import Link from "next/link";
import {
  getConversation,
  markConversationRead,
  sendDirectMessage,
} from "@/app/actions/messages";
import { SafeLink } from "@/components/media/safe-link";

type ConversationPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    message?: string;
  }>;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

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
  attachments: NonNullable<Awaited<ReturnType<typeof getConversation>>>["messages"][number]["attachments"];
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
        <Link href="/messages" className="text-sm font-semibold text-[#8a3f1e] transition hover:text-[#cf5f2b]">
          Back to messages
        </Link>
        <div className="mt-8 rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
            Messages
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Conversation unavailable</h1>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-[#67564c]">
            This conversation may have been removed, or you may not have access to it.
          </p>
        </div>
      </div>
    </section>
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
  const participantLabels =
    conversation.participants
      .map((participant) => participant.username ? `@${participant.username}` : participant.user_id)
      .join(" - ") || "Participants unavailable";

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/messages" className="text-sm font-semibold text-[#8a3f1e] transition hover:text-[#cf5f2b]">
          Back to messages
        </Link>
        <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/70 p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
            Conversation
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
          <p className="mt-3 break-words text-sm text-[#67564c]">{participantLabels}</p>
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
                Send the first text message in this conversation.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {conversation.messages.map((message) => {
                const sender = conversation.participants.find((participant) => participant.user_id === message.sender_id);

                return (
                  <article key={message.id} className="rounded-xl border border-[#ead6c5] bg-white p-4">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <p className="font-semibold">{sender?.display_name || "Selah Ember Member"}</p>
                      <p className="text-sm text-[#8a3f1e]">{formatMessageDate(message.created_at)}</p>
                    </div>
                    <MessageBody body={message.deleted_at ? "Message deleted" : message.body} />
                    {!message.deleted_at ? <MessageAttachments attachments={message.attachments} /> : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <form action={sendDirectMessage} className="mt-6 rounded-2xl border border-[#ead6c5] bg-white/70 p-5 shadow-sm">
          <input type="hidden" name="conversation_id" value={conversation.id} />
          <label className="block">
            <span className="text-sm font-medium text-[#3b312b]">Message</span>
            <textarea
              name="body"
              rows={4}
              maxLength={5000}
              className={inputClassName}
            />
          </label>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-[#3b312b]">Image or video</span>
              <input
                name="attachment"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                className={inputClassName}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#3b312b]">Link</span>
              <input name="link_url" type="url" placeholder="https://example.com" className={inputClassName} />
            </label>
          </div>
          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-[#67564c]">
              Text up to 5000 characters. Images: JPG, PNG, WebP, GIF up to 10MB. Videos: MP4, WebM, MOV up to 250MB.
            </p>
            <button
              type="submit"
              className="rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
