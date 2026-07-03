"use client";

import { SmilePlus } from "lucide-react";
import { useRef, useState } from "react";
import { addMessageReaction, removeMessageReaction, type MessageReaction } from "@/app/actions/messages";
import { useDismissibleLayer } from "@/components/ui/use-dismissible-layer";
import { MESSAGE_REACTION_OPTIONS } from "@/lib/messages/reactions";

type MessageReactionsProps = {
  conversationId: string;
  currentUserId: string;
  messageId: string;
  reactions: MessageReaction[];
  returnTo?: string;
};

export function MessageReactions({
  conversationId,
  currentUserId,
  messageId,
  reactions,
  returnTo,
}: MessageReactionsProps) {
  const reactionCounts = new Map<string, number>();
  const currentUserReactions = new Set(
    reactions.filter((reaction) => reaction.user_id === currentUserId).map((reaction) => reaction.reaction),
  );

  for (const reaction of reactions) {
    reactionCounts.set(reaction.reaction, (reactionCounts.get(reaction.reaction) || 0) + 1);
  }
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const visibleReactionCounts = MESSAGE_REACTION_OPTIONS.filter((reaction) => reactionCounts.has(reaction));

  useDismissibleLayer({ open, setOpen, triggerRef, layerRef: pickerRef });

  return (
    <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1.5">
        {visibleReactionCounts.map((reaction) => {
          const hasReacted = currentUserReactions.has(reaction);
          const count = reactionCounts.get(reaction) || 0;

          return (
            <span
              key={reaction}
              className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                hasReacted
                  ? "border-[#a94720] bg-[#fff4e8] text-[#8a3f1e]"
                  : "border-[#2f2722]/10 bg-[#fffaf4] text-[#67564c]"
              }`}
            >
              <span aria-hidden="true">{reaction}</span>
              <span>{count}</span>
            </span>
          );
        })}
      </div>

      <div className="relative ml-auto">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d79568]/35 bg-white/85 text-[#8a3f1e] opacity-100 shadow-sm transition hover:border-[#a94720] hover:bg-[#fff4e8] focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Add reaction"
          aria-expanded={open}
          aria-controls={`message-reactions-${messageId}`}
          aria-haspopup="true"
        >
          <SmilePlus aria-hidden="true" className="h-4 w-4" />
        </button>

        {open ? (
          <div
            ref={pickerRef}
            id={`message-reactions-${messageId}`}
            className="absolute bottom-12 right-0 z-10 grid w-[min(20rem,calc(100vw-3rem))] grid-cols-6 gap-1 rounded-2xl border border-[#ead6c5] bg-white p-2 shadow-xl shadow-[#2f1608]/15"
          >
            {MESSAGE_REACTION_OPTIONS.map((reaction) => {
              const hasReacted = currentUserReactions.has(reaction);

              return (
                <form key={reaction} action={hasReacted ? removeMessageReaction : addMessageReaction}>
                  <input type="hidden" name="conversation_id" value={conversationId} />
                  <input type="hidden" name="message_id" value={messageId} />
                  <input type="hidden" name="reaction" value={reaction} />
                  {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
                  <button
                    type="submit"
                    aria-label={`${hasReacted ? "Remove" : "Add"} ${reaction} reaction`}
                    className={`inline-flex h-11 w-full items-center justify-center rounded-full text-lg transition ${
                      hasReacted ? "bg-[#fff4e8] ring-1 ring-[#a94720]" : "hover:bg-[#fff4e8]"
                    }`}
                  >
                    <span aria-hidden="true">{reaction}</span>
                  </button>
                </form>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
