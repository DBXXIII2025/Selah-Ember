"use client";

import { useMemo, useState, useTransition } from "react";
import { toggleOpenCommunityPostReactionState } from "@/app/actions/community-posts";
import type { CommunityPost } from "@/app/actions/community-posts";

const reactionLabels = {
  like: "Like",
  pray: "Pray",
  fire: "Fire",
  laugh: "Laugh",
} as const;

type Reaction = keyof typeof reactionLabels;

type ReactionState = {
  counts: Record<Reaction, number>;
  selected: Reaction[];
};

type CommunityPostReactionsProps = {
  postId: string;
  counts: CommunityPost["reaction_counts"];
  selected: CommunityPost["viewer_reactions"];
  returnTo: string;
};

function normalizeState(counts: CommunityPost["reaction_counts"], selected: CommunityPost["viewer_reactions"]): ReactionState {
  return {
    counts: {
      like: counts.like || 0,
      pray: counts.pray || 0,
      fire: counts.fire || 0,
      laugh: counts.laugh || 0,
    },
    selected: selected.filter((reaction): reaction is Reaction => reaction in reactionLabels),
  };
}

function toggleLocalReaction(state: ReactionState, reaction: Reaction): ReactionState {
  const selected = state.selected.includes(reaction);
  return {
    counts: {
      ...state.counts,
      [reaction]: Math.max(0, state.counts[reaction] + (selected ? -1 : 1)),
    },
    selected: selected
      ? state.selected.filter((item) => item !== reaction)
      : [...state.selected, reaction],
  };
}

export function CommunityPostReactions({ postId, counts, selected, returnTo }: CommunityPostReactionsProps) {
  const initialState = useMemo(() => normalizeState(counts, selected), [counts, selected]);
  const [state, setState] = useState(initialState);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function onToggle(reaction: Reaction) {
    if (isPending) return;
    const previous = state;
    setError("");
    setState(toggleLocalReaction(previous, reaction));
    startTransition(async () => {
      const result = await toggleOpenCommunityPostReactionState({ postId, reaction, returnTo });
      if (!result.ok) {
        setState(previous);
        setError(result.message || "Reaction could not be saved.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      {Object.entries(reactionLabels).map(([reaction, label]) => {
        const typedReaction = reaction as Reaction;
        const isSelected = state.selected.includes(typedReaction);
        const count = state.counts[typedReaction] || 0;

        return (
          <button
            key={reaction}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${isSelected ? "Remove" : "Add"} ${label} reaction, ${count} ${count === 1 ? "reaction" : "reactions"}`}
            disabled={isPending}
            onClick={() => onToggle(typedReaction)}
            className={`inline-flex h-11 min-w-16 items-center justify-center gap-1 rounded-full border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-80 ${
              isSelected
                ? "border-[#a94720] bg-[#fff4e8] text-[#8a3f1e]"
                : "border-[#2f2722]/15 bg-white/70 text-[#594a42] hover:bg-[#fff4e8]"
            }`}
          >
            <span>{label}</span>
            <span className="tabular-nums">{count}</span>
          </button>
        );
      })}
      {error ? <p className="basis-full text-sm font-semibold text-[#8a3f1e]">{error}</p> : null}
    </div>
  );
}
