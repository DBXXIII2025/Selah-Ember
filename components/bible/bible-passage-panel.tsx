"use client";

import { useState, type ReactNode } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function BiblePassagePanel({ children }: Readonly<{ children: ReactNode }>) {
  const [open, setOpen] = useState(false);

  return (
    <aside aria-label="Bible navigation" className="rounded-2xl border border-[#ead6c5] bg-white/75 p-3 sm:p-5 xl:sticky xl:top-24">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="bible-passage-options"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 text-left text-sm font-semibold text-[#3b312b] hover:bg-[#f8ecdf] xl:hidden"
      >
        <span className="flex items-center gap-2">
          <BookOpen aria-hidden="true" className="h-4 w-4 text-[#a94720]" />
          Change passage or search
        </span>
        <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      <div id="bible-passage-options" className={cn("pt-3 xl:block xl:pt-0", open ? "block" : "hidden")}>
        {children}
      </div>
    </aside>
  );
}
