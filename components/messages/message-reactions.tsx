import { addMessageReaction, removeMessageReaction, type MessageReaction } from "@/app/actions/messages";
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

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#ead6c5] pt-4">
      {MESSAGE_REACTION_OPTIONS.map((reaction) => {
        const hasReacted = currentUserReactions.has(reaction);
        const count = reactionCounts.get(reaction) || 0;

        return (
          <form key={reaction} action={hasReacted ? removeMessageReaction : addMessageReaction}>
            <input type="hidden" name="conversation_id" value={conversationId} />
            <input type="hidden" name="message_id" value={messageId} />
            <input type="hidden" name="reaction" value={reaction} />
            {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
            <button
              type="submit"
              aria-label={`${hasReacted ? "Remove" : "Add"} ${reaction} reaction`}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                hasReacted
                  ? "border-[#cf5f2b] bg-[#fff4e8] text-[#8a3f1e] shadow-sm"
                  : "border-[#2f2722]/15 bg-white/80 text-[#2f2722] hover:border-[#d79568] hover:bg-[#fff8ef]"
              }`}
            >
              <span aria-hidden="true">{reaction}</span>
              {count > 0 ? <span>{count}</span> : null}
            </button>
          </form>
        );
      })}
    </div>
  );
}
