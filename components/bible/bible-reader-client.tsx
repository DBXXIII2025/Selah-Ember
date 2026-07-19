"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Check, Copy, Share2, Type } from "lucide-react";
import { saveBibleReadingLocation } from "@/app/actions/bible";
import type { BibleReference } from "@/lib/bible/types";
import { cn } from "@/lib/utils/cn";

const fontSizes = [
  { id: "comfortable", label: "Comfortable", className: "text-lg leading-9" },
  { id: "large", label: "Large", className: "text-xl leading-10" },
  { id: "compact", label: "Compact", className: "text-base leading-8" },
] as const;

type FontSize = (typeof fontSizes)[number]["id"];

export function BibleReaderShell({
  reference,
  children,
}: Readonly<{
  reference: BibleReference;
  children: ReactNode;
}>) {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof window === "undefined") return "comfortable";
    const saved = window.localStorage.getItem("selah-bible-font-size");
    return saved === "comfortable" || saved === "large" || saved === "compact" ? saved : "comfortable";
  });

  useEffect(() => {
    window.localStorage.setItem("selah-bible-font-size", fontSize);
  }, [fontSize]);

  useEffect(() => {
    void saveBibleReadingLocation(reference);
  }, [reference]);

  const selected = fontSizes.find((size) => size.id === fontSize) || fontSizes[0];

  return (
    <section className="mt-6" aria-label="Bible reader">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ead6c5] bg-white/70 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#3b312b]">
          <Type aria-hidden="true" className="h-4 w-4" />
          Text size
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Adjust Bible text size">
          {fontSizes.map((size) => (
            <button
              key={size.id}
              type="button"
              aria-pressed={fontSize === size.id}
              onClick={() => setFontSize(size.id)}
              className={cn(
                "min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a94720]/20",
                fontSize === size.id
                  ? "border-[#a94720] bg-[#a94720] text-white"
                  : "border-[#d9b99d] bg-white text-[#3b312b] hover:bg-[#fff4e8]",
              )}
            >
              {size.label}
            </button>
          ))}
        </div>
      </div>
      <div className={cn("space-y-7 rounded-2xl border border-[#ead6c5] bg-[#fffdf9] p-5 text-[#211814] shadow-sm sm:p-8", selected.className)}>
        {children}
      </div>
    </section>
  );
}

export function BibleVerseShareTools({
  reference,
  text,
  href,
}: Readonly<{
  reference: string;
  text: string;
  href: string;
}>) {
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function copyVerse() {
    startTransition(async () => {
      await navigator.clipboard.writeText(`${reference} ${text}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  }

  function shareVerse() {
    startTransition(async () => {
      const shareData = {
        title: reference,
        text: `${reference} ${text}`,
        url: `${window.location.origin}${href}`,
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={copyVerse}
        disabled={isPending}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9b99d] bg-white px-3 py-2 text-sm font-semibold text-[#3b312b] transition hover:bg-[#fff4e8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a94720]/20 disabled:opacity-60"
      >
        {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <button
        type="button"
        onClick={shareVerse}
        disabled={isPending}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9b99d] bg-white px-3 py-2 text-sm font-semibold text-[#3b312b] transition hover:bg-[#fff4e8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a94720]/20 disabled:opacity-60"
      >
        <Share2 aria-hidden="true" className="h-4 w-4" />
        <span>Share</span>
      </button>
    </div>
  );
}
