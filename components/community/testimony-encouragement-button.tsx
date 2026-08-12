"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleTestimonyEncouragementState } from "@/app/actions/community-topics";

type TestimonyEncouragementButtonProps = {
  testimonyId: string;
  count: number;
  encouraged: boolean;
  returnTo: string;
};

export function TestimonyEncouragementButton({
  testimonyId,
  count,
  encouraged,
  returnTo,
}: TestimonyEncouragementButtonProps) {
  const [localCount, setLocalCount] = useState(count);
  const [localEncouraged, setLocalEncouraged] = useState(encouraged);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onToggle() {
    if (isPending) return;
    const previousCount = localCount;
    const previousEncouraged = localEncouraged;
    const nextEncouraged = !previousEncouraged;
    setError("");
    setLocalEncouraged(nextEncouraged);
    setLocalCount(Math.max(0, previousCount + (nextEncouraged ? 1 : -1)));

    startTransition(async () => {
      const result = await toggleTestimonyEncouragementState({ testimonyId, returnTo });
      if (!result.ok) {
        setLocalCount(previousCount);
        setLocalEncouraged(previousEncouraged);
        setError(result.message || "Encouragement could not be saved.");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3" aria-live="polite">
      <button
        type="button"
        aria-pressed={localEncouraged}
        disabled={isPending}
        onClick={onToggle}
        className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-80 ${
          localEncouraged
            ? "border border-[#d9b99d] bg-white text-[#8a3f1e] hover:bg-[#fff4e8]"
            : "bg-[#a94720] text-white shadow-[#a94720]/20 hover:bg-[#b94f22]"
        }`}
      >
        Encouraged me
      </button>
      <span className="text-sm text-[#67564c]">
        {localCount} {localCount === 1 ? "member" : "members"} encouraged
      </span>
      {error ? <p className="basis-full text-sm font-semibold text-[#8a3f1e]">{error}</p> : null}
    </div>
  );
}
