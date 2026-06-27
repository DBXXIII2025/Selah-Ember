import type { ReactNode } from "react";
import Image from "next/image";
import type { MessageAttachment } from "@/app/actions/messages";
import { SafeLink } from "@/components/media/safe-link";
import { Badge, ContentCard } from "@/components/ui/app-ui";
import { cn } from "@/lib/utils/cn";

function MessageBody({ body, deleted }: Readonly<{ body: string; deleted?: boolean }>) {
  if (deleted) {
    return <p className="mt-3 text-sm italic text-[#8a7467]">Message deleted</p>;
  }

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

function MessageAttachments({ attachments }: Readonly<{ attachments: MessageAttachment[] }>) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {attachments.map((attachment) => {
        if (attachment.kind === "image") {
          return attachment.signed_url ? (
            <Image
              key={attachment.id}
              src={attachment.signed_url}
              alt={attachment.filename || "Message image"}
              width={896}
              height={896}
              sizes="(max-width: 640px) 85vw, 42rem"
              unoptimized
              className="h-auto max-h-[28rem] w-auto max-w-full rounded-xl border border-[#ead6c5] object-contain"
            />
          ) : (
            <p key={attachment.id} className="text-sm text-[#67564c]">Image unavailable.</p>
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
            <p key={attachment.id} className="text-sm text-[#67564c]">Video unavailable.</p>
          );
        }

        return (
          <SafeLink
            key={attachment.id}
            href={attachment.url}
            className="inline-flex max-w-full break-all rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
          >
            {attachment.filename || attachment.url}
          </SafeLink>
        );
      })}
    </div>
  );
}

export function MessageDisplay({
  senderName,
  timestamp,
  body,
  attachments,
  isOwn = false,
  deleted = false,
  deliveryLabel,
  children,
}: Readonly<{
  senderName: string;
  timestamp: string;
  body: string;
  attachments: MessageAttachment[];
  isOwn?: boolean;
  deleted?: boolean;
  deliveryLabel?: string;
  children?: ReactNode;
}>) {
  return (
    <ContentCard
      className={cn(
        "group w-fit max-w-[94%] rounded-2xl p-4 sm:max-w-[82%]",
        isOwn ? "ml-auto border-[#e5b08c] bg-[#fff8ef]" : "mr-auto bg-white",
      )}
    >
      <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[#3b312b]">{isOwn ? "You" : senderName}</p>
          {deliveryLabel ? <Badge tone="neutral">{deliveryLabel}</Badge> : null}
        </div>
        <time className="text-xs text-[#8a7467]">{timestamp}</time>
      </div>
      <MessageBody body={body} deleted={deleted} />
      {!deleted ? <MessageAttachments attachments={attachments} /> : null}
      {!deleted && children ? <div className="mt-3">{children}</div> : null}
    </ContentCard>
  );
}
