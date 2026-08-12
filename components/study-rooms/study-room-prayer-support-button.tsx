"use client";

import { useState, useTransition } from "react";
import { toggleStudyRoomPrayerSupportState } from "@/app/actions/study-rooms";

type StudyRoomPrayerSupportButtonProps = {
  roomId: string;
  prayerId: string;
  count: number;
  supported: boolean;
  returnTo: string;
};

export function StudyRoomPrayerSupportButton({
  roomId,
  prayerId,
  count,
  supported,
  returnTo,
}: StudyRoomPrayerSupportButtonProps) {
  const [localCount, setLocalCount] = useState(count);
  const [localSupported, setLocalSupported] = useState(supported);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function onToggle() {
    if (isPending) return;
    const previousCount = localCount;
    const previousSupported = localSupported;
    const nextSupported = !previousSupported;
    setError("");
    setLocalSupported(nextSupported);
    setLocalCount(Math.max(0, previousCount + (nextSupported ? 1 : -1)));

    startTransition(async () => {
      const result = await toggleStudyRoomPrayerSupportState({ roomId, prayerId, returnTo });
      if (!result.ok) {
        setLocalCount(previousCount);
        setLocalSupported(previousSupported);
        setError(result.message || "Prayer support could not be saved.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      <button
        type="button"
        aria-pressed={localSupported}
        disabled={isPending}
        onClick={onToggle}
        className="inline-flex h-11 items-center justify-center rounded-full border border-[#d9b99d] bg-white px-5 text-sm font-semibold text-[#8a3f1e] transition hover:bg-[#fff4e8] disabled:cursor-not-allowed disabled:opacity-80"
      >
        {localSupported ? "Praying" : "I'm praying"} ({localCount})
      </button>
      {error ? <p className="basis-full text-sm font-semibold text-[#8a3f1e]">{error}</p> : null}
    </div>
  );
}
