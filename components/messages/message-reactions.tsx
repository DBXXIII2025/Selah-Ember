"use client";

import { SmilePlus } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import {
  addMessageReactionState,
  removeMessageReactionState,
  type MessageReaction,
} from "@/app/actions/messages";
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
  currentUserId,
  messageId,
  reactions,
  returnTo,
}: MessageReactionsProps) {
  const [localReactions, setLocalReactions] = useState(reactions);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const reactionCounts = new Map<string, number>();
  const currentUserReactions = new Set(
    localReactions.filter((reaction) => reaction.user_id === currentUserId).map((reaction) => reaction.reaction),
  );

  for (const reaction of localReactions) {
    reactionCounts.set(reaction.reaction, (reactionCounts.get(reaction.reaction) || 0) + 1);
  }

  const visibleReactionCounts = MESSAGE_REACTION_OPTIONS.filter((reaction) => reactionCounts.has(reaction));
  useDismissibleLayer({ open, setOpen, triggerRef, layerRef: pickerRef });

  function applyLocalReaction(reaction: string, hasReacted: boolean) {
    return hasReacted
      ? localReactions.filter((item) => !(item.user_id === currentUserId && item.reaction === reaction))
      : [
          ...localReactions,
          {
            id: `optimistic-${messageId}-${currentUserId}-${reaction}`,
            message_id: messageId,
            user_id: currentUserId,
            reaction,
            created_at: new Date().toISOString(),
          },
        ];
  }

  function onToggleReaction(reaction: string, hasReacted: boolean) {
    if (isPending) return;
    const previous = localReactions;
    setError("");
    setLocalReactions(applyLocalReaction(reaction, hasReacted));
    setOpen(false);

    startTransition(async () => {
      const result = hasReacted
        ? await removeMessageReactionState({ messageId, reaction, returnTo })
        : await addMessageReactionState({ messageId, reaction, returnTo });

      if (!result.ok) {
        setLocalReactions(previous);
        setError(result.message || "Reaction could not be saved.");
      }
    });
  }

  return (
    <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2" aria-live="polite">
      <div className="flex flex-wrap gap-1.5">
        {visibleReactionCounts.map((reaction, index) => {
          const hasReacted = currentUserReactions.has(reaction);
          const count = reactionCounts.get(reaction) || 0;

          return (
            <span
              key={reaction}
              data-testid={`message-reaction-chip-${messageId}-${index}`}
              aria-pressed={hasReacted}
              className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                hasReacted
                  ? "border-[#a94720] bg-[#fff4e8] text-[#8a3f1e]"
                  : "border-[#2f2722]/10 bg-[#fffaf4] text-[#67564c]"
              }`}
            >
              <span aria-hidden="true">{reaction}</span>
              <span className="tabular-nums">{count}</span>
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
            {MESSAGE_REACTION_OPTIONS.map((reaction, index) => {
              const hasReacted = currentUserReactions.has(reaction);

              return (
                <div key={reaction}>
                  <button
                    type="button"
                    data-testid={`message-reaction-option-${messageId}-${index}`}
                    aria-label={`${hasReacted ? "Remove" : "Add"} ${reaction} reaction`}
                    aria-pressed={hasReacted}
                    disabled={isPending}
                    onClick={() => onToggleReaction(reaction, hasReacted)}
                    className={`inline-flex h-11 w-full items-center justify-center rounded-full text-lg transition disabled:cursor-not-allowed disabled:opacity-80 ${
                      hasReacted ? "bg-[#fff4e8] ring-1 ring-[#a94720]" : "hover:bg-[#fff4e8]"
                    }`}
                  >
                    <span aria-hidden="true">{reaction}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      {error ? <p className="basis-full text-sm font-semibold text-[#8a3f1e]">{error}</p> : null}
    </div>
  );
}
