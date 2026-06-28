"use client";

import { Archive, Ban, EllipsisVertical, Flag, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { archiveConversation, blockUser, reportConversationOrMessage } from "@/app/actions/messages";
import { useDismissibleLayer } from "@/components/ui/use-dismissible-layer";

type ConversationToolsMenuProps = {
  conversationId: string;
  otherParticipant?: {
    user_id: string;
    display_name: string;
  } | null;
};

export function ConversationToolsMenu({ conversationId, otherParticipant }: ConversationToolsMenuProps) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useDismissibleLayer({ open, setOpen, triggerRef, layerRef: menuRef });

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d79568]/50 bg-[#fff8ef] text-[#8a3f1e] shadow-sm transition hover:border-[#cf5f2b] hover:bg-[#fff0df] hover:shadow-[0_0_18px_rgba(207,95,43,0.18)]"
        aria-label="Conversation tools"
        aria-expanded={open}
        aria-controls="conversation-tools-menu"
        aria-haspopup="true"
      >
        <EllipsisVertical aria-hidden="true" className="h-5 w-5" />
      </button>

      {open ? (
        <div ref={menuRef} id="conversation-tools-menu" className="absolute right-0 top-12 z-20 w-[min(18rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[#ead6c5] bg-white p-2 shadow-xl shadow-[#2f1608]/15">
          <Link
            href="/messages"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[#3b312b] transition hover:bg-[#fff4e8] hover:text-[#b94f22]"
          >
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            Back to messages
          </Link>

          <form action={archiveConversation}>
            <input type="hidden" name="conversation_id" value={conversationId} />
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#3b312b] transition hover:bg-[#fff4e8] hover:text-[#b94f22]"
            >
              <Archive aria-hidden="true" className="h-4 w-4" />
              Archive conversation
            </button>
          </form>

          <button
            type="button"
            onClick={() => setReportOpen((value) => !value)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#3b312b] transition hover:bg-[#fff4e8] hover:text-[#b94f22]"
          >
            <Flag aria-hidden="true" className="h-4 w-4" />
            Report conversation
          </button>

          {reportOpen ? (
            <form action={reportConversationOrMessage} className="m-2 rounded-xl border border-[#ead6c5] bg-[#fffaf4] p-3">
              <input type="hidden" name="conversation_id" value={conversationId} />
              <label className="block">
                <span className="text-xs font-semibold text-[#3b312b]">Reason</span>
                <select
                  name="reason"
                  required
                  defaultValue="safety"
                  className="mt-1 w-full rounded-lg border border-[#ead6c5] bg-white px-3 py-2 text-sm outline-none focus:border-[#cf5f2b]"
                >
                  <option value="safety">Safety concern</option>
                  <option value="harassment">Harassment</option>
                  <option value="spam">Spam or scam</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <textarea
                name="details"
                rows={2}
                maxLength={1000}
                placeholder="Optional details"
                className="mt-2 w-full rounded-lg border border-[#ead6c5] bg-white px-3 py-2 text-sm outline-none focus:border-[#cf5f2b]"
              />
              <div className="mt-2 flex gap-2">
                <button type="submit" className="rounded-full bg-[#cf5f2b] px-3 py-2 text-xs font-semibold text-white">
                  Submit
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="rounded-full border border-[#2f2722]/20 px-3 py-2 text-xs font-semibold text-[#2f2722]"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {otherParticipant ? (
            <form action={blockUser}>
              <input type="hidden" name="conversation_id" value={conversationId} />
              <input type="hidden" name="blocked_user_id" value={otherParticipant.user_id} />
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#b42318] transition hover:bg-[#fff1f0]"
              >
                <Ban aria-hidden="true" className="h-4 w-4" />
                Block {otherParticipant.display_name}
              </button>
            </form>
          ) : null}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#67564c] transition hover:bg-[#fff4e8]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
