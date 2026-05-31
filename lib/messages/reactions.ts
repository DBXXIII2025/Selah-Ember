export const MESSAGE_REACTION_OPTIONS = ["🙏", "👍", "😂", "😢", "🔥"] as const;

export type MessageReactionOption = (typeof MESSAGE_REACTION_OPTIONS)[number];

export function isAllowedMessageReaction(value: string): value is MessageReactionOption {
  return MESSAGE_REACTION_OPTIONS.includes(value as MessageReactionOption);
}
