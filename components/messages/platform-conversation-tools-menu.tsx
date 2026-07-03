"use client";

import { EllipsisVertical, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useDismissibleLayer } from "@/components/ui/use-dismissible-layer";

export function PlatformConversationToolsMenu() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useDismissibleLayer({ open, setOpen, triggerRef, layerRef: menuRef });

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d79568]/50 bg-[#fff8ef] text-[#8a3f1e] shadow-sm transition hover:border-[#a94720] hover:bg-[#fff0df] hover:shadow-[0_0_18px_rgba(207,95,43,0.18)]"
        aria-label="Platform conversation tools"
        aria-expanded={open}
        aria-controls="platform-conversation-tools-menu"
        aria-haspopup="true"
      >
        <EllipsisVertical aria-hidden="true" className="h-5 w-5" />
      </button>

      {open ? (
        <div ref={menuRef} id="platform-conversation-tools-menu" className="absolute right-0 top-12 z-20 w-[min(16rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[#ead6c5] bg-white p-2 shadow-xl shadow-[#2f1608]/15">
          <Link
            href="/platform/messages"
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[#3b312b] transition hover:bg-[#fff4e8] hover:text-[#b94f22]"
          >
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            Back to platform messages
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#67564c] transition hover:bg-[#fff4e8]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
