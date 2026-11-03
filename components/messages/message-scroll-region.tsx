"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function MessageScrollRegion({ children }: Readonly<{ children: ReactNode }>) {
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const region = regionRef.current;
    if (region) region.scrollTop = region.scrollHeight;
  }, []);

  return (
    <div ref={regionRef} role="log" aria-label="Conversation messages" aria-live="off" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-8">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end gap-5">{children}</div>
    </div>
  );
}
