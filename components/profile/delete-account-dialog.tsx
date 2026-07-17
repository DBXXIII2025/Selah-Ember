"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { deleteCurrentUserAccount } from "@/app/actions/profile";
import {
  ActionButton,
  DestructiveActionPanel,
  FormField,
  FormHint,
  FormLabel,
  formControlClassName,
} from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <DestructiveActionPanel
      title="Delete account"
      description="Permanently delete your Selah Ember account, profile, private data, posts, comments, group activity, messages, uploads, and other associated account data where applicable. This cannot be undone."
      className="mt-8"
    >
      <ActionButton type="button" variant="danger" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        Delete account
      </ActionButton>

      <dialog
        ref={dialogRef}
        onCancel={() => setOpen(false)}
        className="w-[min(92vw,34rem)] rounded-2xl border border-[#e5b2a7] bg-[#fffaf4] p-0 text-[#211814] shadow-2xl backdrop:bg-[#211814]/55"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
      >
        <div className="border-b border-[#ead6c5] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="delete-account-title" className="text-xl font-semibold text-[#7a271a]">
                Delete account
              </h2>
              <p id="delete-account-description" className="mt-2 text-sm leading-6 text-[#67564c]">
                This permanently removes your account and scrubs or deletes associated Selah Ember data. You will be signed out after deletion.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-[#715e54] transition hover:bg-[#fff1ed] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b42318]/20"
              aria-label="Cancel account deletion"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form action={deleteCurrentUserAccount} className="p-5 sm:p-6">
          <div className="rounded-xl border border-[#ead6c5] bg-white/70 p-4 text-sm leading-6 text-[#3b312b]">
            <p className="font-semibold">Deleted or scrubbed data includes:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Account identity, profile information, memberships, notifications, saved read state, and private prayer data.</li>
              <li>Direct-message attachments, message reactions, blocks, reports you submitted, and uploaded files.</li>
              <li>Community posts, comments, group discussions, replies, reactions, RSVPs, giving drafts, and media you own.</li>
            </ul>
          </div>

          <FormField className="mt-5">
            <FormLabel htmlFor="delete-account-confirmation" required>
              Type DELETE to confirm
            </FormLabel>
            <input
              ref={inputRef}
              id="delete-account-confirmation"
              name="confirmation"
              type="text"
              required
              autoComplete="off"
              pattern="DELETE"
              className={formControlClassName}
            />
            <FormHint>Supabase requires a valid signed-in session. If your session is no longer valid, sign in again before deleting your account.</FormHint>
          </FormField>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <ActionButton type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </ActionButton>
            <SubmitButton variant="danger" pendingLabel="Deleting account...">
              Delete account
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </DestructiveActionPanel>
  );
}
