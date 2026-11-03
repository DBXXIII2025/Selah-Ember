import type { ReactNode } from "react";
import Image from "next/image";
import type { MessageAttachment } from "@/app/actions/messages";
import { SafeLink } from "@/components/media/safe-link";
import { cn } from "@/lib/utils/cn";

function MessageBody({ body, deleted }: Readonly<{ body: string; deleted?: boolean }>) {
  if (deleted) {
    return <p className="mt-3 text-sm italic text-[#715e54]">Message deleted</p>;
  }

  const urlPattern = /(https?:\/\/[^\s<>"']+)/g;
  const parts = body.split(urlPattern);

  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#3b312b] sm:text-base">
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
    <article className={cn("group flex w-full items-start gap-3", isOwn ? "justify-end" : "justify-start")}>
      {!isOwn ? (
        <div aria-hidden="true" className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e8cbb0] text-xs font-bold text-[#763c20]">
          {senderName.slice(0, 1).toUpperCase()}
        </div>
      ) : null}
      <div className={cn("min-w-0 max-w-[calc(100%-3.5rem)] sm:max-w-[min(82%,38rem)]", isOwn ? "ml-auto" : "")}>
        <div className={cn(
          "rounded-2xl px-4 py-3",
          isOwn ? "rounded-br-md bg-[#f1ddcb] text-[#211814]" : "rounded-bl-md bg-white text-[#211814]",
        )}>
          {!isOwn ? <p className="mb-1.5 text-xs font-bold text-[#8a3f1e]">{senderName}</p> : null}
          <MessageBody body={body} deleted={deleted} />
          {!deleted ? <MessageAttachments attachments={attachments} /> : null}
        </div>
        <div className={cn("mt-1.5 flex flex-wrap items-center gap-3 px-2", isOwn ? "justify-end" : "justify-start")}>
          <time className="text-[11px] text-[#806a5f]">{timestamp}</time>
          {deliveryLabel ? <span className="text-[11px] text-[#806a5f]">{deliveryLabel}</span> : null}
          {!deleted && children ? (
            <details className="relative text-xs">
              <summary className="cursor-pointer rounded-md px-1 font-semibold text-[#8a3f1e] hover:text-[#a94720]">Actions</summary>
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-[#ead6c5] bg-white p-2 shadow-sm">
                {children}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </article>
  );
}
