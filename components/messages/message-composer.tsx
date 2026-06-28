"use client";

import { Image as ImageIcon, Link as LinkIcon, LoaderCircle, Paperclip, Send, SmilePlus, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { sendDirectMessage } from "@/app/actions/messages";
import { FormError, formControlClassName } from "@/components/ui/app-ui";
import { isSafeHttpUrl, MEDIA_LIMITS, validateImageFile, validateVideoFile } from "@/lib/media/validation";

type MessageComposerProps = {
  conversationId: string;
  returnTo?: string;
};

const imageAccept = "image/jpeg,image/png,image/webp,image/gif";
const videoAccept = "video/mp4,video/webm,video/quicktime";
const composerEmojiOptions = ["🙏", "👍", "😂", "😢", "🔥", "😊", "😄", "😭", "😮", "👏", "🙌", "🕊", "📖", "🌿"];

type SelectedFile = {
  name: string;
  type: string;
};

function fileKindLabel(file: SelectedFile | null) {
  if (!file) {
    return null;
  }

  if (file.type.startsWith("image/")) {
    return "Image";
  }

  if (file.type.startsWith("video/")) {
    return "Video";
  }

  return "File";
}

function SendMessageButton({ disabled }: Readonly<{ disabled: boolean }>) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="absolute bottom-3 right-3 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#cf5f2b] px-5 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22] hover:shadow-[#cf5f2b]/30 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="h-4 w-4" />}
      {pending ? "Sending…" : "Send"}
    </button>
  );
}

export function MessageComposer({ conversationId, returnTo }: MessageComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);
  const [body, setBody] = useState("");
  const [fileAccept, setFileAccept] = useState(imageAccept);
  const [linkDraft, setLinkDraft] = useState("");
  const [selectedLink, setSelectedLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [composerError, setComposerError] = useState("");
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  useEffect(() => {
    if (!menuOpen && !emojiOpen && !linkPanelOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setEmojiOpen(false);
        setLinkPanelOpen(false);
        textareaRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [emojiOpen, linkPanelOpen, menuOpen]);

  function openFilePicker(accept: string) {
    const input = fileInputRef.current;

    if (!input) {
      return;
    }

    setFileAccept(accept);
    input.accept = accept;
    input.click();
    setMenuOpen(false);
    setComposerError("");
  }

  function chooseLink() {
    setLinkPanelOpen(true);
    setMenuOpen(false);
    setEmojiOpen(false);
    setLinkError("");
  }

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current;

    if (!textarea) {
      setBody((value) => `${value}${emoji}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = `${body.slice(0, start)}${emoji}${body.slice(end)}`;
    setBody(nextValue);
    setEmojiOpen(false);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + emoji.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function applyLink() {
    const value = linkDraft.trim();

    if (!isSafeHttpUrl(value)) {
      setLinkError("Enter a safe HTTP or HTTPS link.");
      return;
    }

    setSelectedLink(value);
    setLinkDraft("");
    setLinkError("");
    setLinkPanelOpen(false);
  }

  function removeFile() {
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <form action={sendDirectMessage} encType="multipart/form-data" className="mt-6">
      <input type="hidden" name="conversation_id" value={conversationId} />
      <input type="hidden" name="link_url" value={selectedLink} />
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}

      {(selectedFile || selectedLink) ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedFile ? (
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#d79568]/60 bg-[#fff4e8] px-3 py-2 text-sm font-semibold text-[#5f2e18] shadow-sm">
              {selectedFile.type.startsWith("video/") ? (
                <Video aria-hidden="true" className="h-4 w-4 shrink-0" />
              ) : (
                <ImageIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">
                {fileKindLabel(selectedFile)}: {selectedFile.name}
              </span>
              <button
                type="button"
                onClick={removeFile}
                className="rounded-full p-1 text-[#8a3f1e] transition hover:bg-[#ead6c5]"
                aria-label="Remove selected file"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : null}

          {selectedLink ? (
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#d79568]/60 bg-[#fff4e8] px-3 py-2 text-sm font-semibold text-[#5f2e18] shadow-sm">
              <LinkIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="truncate">{selectedLink}</span>
              <button
                type="button"
                onClick={() => setSelectedLink("")}
                className="rounded-full p-1 text-[#8a3f1e] transition hover:bg-[#ead6c5]"
                aria-label="Remove selected link"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="relative rounded-2xl border border-[#d8bea3] bg-white/85 p-3 shadow-lg shadow-[#2f1608]/5 transition focus-within:border-[#cf5f2b] focus-within:shadow-[#cf5f2b]/15">
        <label className="sr-only" htmlFor="message-body">
          Message
        </label>
        <textarea
          ref={textareaRef}
          id="message-body"
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Write a message..."
          className="min-h-28 w-full resize-none rounded-xl border-0 bg-transparent px-3 pb-14 pt-2 leading-7 text-[#2f2722] outline-none placeholder:text-[#9a8170]"
        />

        <input
          ref={fileInputRef}
          name="attachment"
          type="file"
          accept={fileAccept}
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] || null;

            if (!file) {
              setSelectedFile(null);
              return;
            }

            const allowedTypes = fileAccept.split(",");

            if (!allowedTypes.includes(file.type)) {
              setComposerError("Choose an image or video from the attachment menu.");
              removeFile();
              return;
            }

            const validation = MEDIA_LIMITS.allowedImageMimeTypes.includes(file.type)
              ? validateImageFile(file, { maxBytes: MEDIA_LIMITS.postImageBytes })
              : validateVideoFile(file);

            if (!validation.ok) {
              setComposerError(validation.message || "Choose a supported image or video.");
              removeFile();
              return;
            }

            setComposerError("");
            setSelectedFile({ name: file.name, type: file.type });
          }}
        />

        <div className="absolute bottom-3 left-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMenuOpen((open) => !open);
                setEmojiOpen(false);
                setLinkPanelOpen(false);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d79568]/50 bg-[#fff8ef] text-[#8a3f1e] shadow-sm transition hover:border-[#cf5f2b] hover:bg-[#fff0df] hover:shadow-[0_0_18px_rgba(207,95,43,0.18)]"
              aria-label="Add attachment"
              aria-expanded={menuOpen}
              aria-controls="message-attachment-menu"
              aria-haspopup="true"
            >
              <Paperclip aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEmojiOpen((open) => !open);
                setMenuOpen(false);
                setLinkPanelOpen(false);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d79568]/50 bg-[#fff8ef] text-[#8a3f1e] shadow-sm transition hover:border-[#cf5f2b] hover:bg-[#fff0df] hover:shadow-[0_0_18px_rgba(207,95,43,0.18)]"
              aria-label="Add emoji"
              aria-expanded={emojiOpen}
              aria-controls="message-emoji-picker"
              aria-haspopup="true"
            >
              <SmilePlus aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          {menuOpen ? (
            <div id="message-attachment-menu" className="absolute bottom-12 left-0 z-10 w-[min(12rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-[#ead6c5] bg-white p-2 shadow-xl shadow-[#2f1608]/15">
              <button
                type="button"
                onClick={() => openFilePicker(imageAccept)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#3b312b] transition hover:bg-[#fff4e8] hover:text-[#b94f22]"
              >
                <ImageIcon aria-hidden="true" className="h-4 w-4" />
                Image
              </button>
              <button
                type="button"
                onClick={() => openFilePicker(videoAccept)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#3b312b] transition hover:bg-[#fff4e8] hover:text-[#b94f22]"
              >
                <Video aria-hidden="true" className="h-4 w-4" />
                Video
              </button>
              <button
                type="button"
                onClick={chooseLink}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#3b312b] transition hover:bg-[#fff4e8] hover:text-[#b94f22]"
              >
                <LinkIcon aria-hidden="true" className="h-4 w-4" />
                Link
              </button>
            </div>
          ) : null}

          {emojiOpen ? (
            <div id="message-emoji-picker" className="absolute bottom-12 left-0 z-10 grid w-[min(14rem,calc(100vw-3rem))] grid-cols-7 gap-1 rounded-2xl border border-[#ead6c5] bg-white p-2 shadow-xl shadow-[#2f1608]/15 sm:left-12">
              {composerEmojiOptions.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg transition hover:bg-[#fff4e8]"
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <SendMessageButton disabled={!body.trim() && !selectedFile && !selectedLink} />
      </div>

      {linkPanelOpen ? (
        <div className="mt-3 rounded-2xl border border-[#ead6c5] bg-white/85 p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="message-link">
              Link URL
            </label>
            <input
              id="message-link"
              type="url"
              value={linkDraft}
              onChange={(event) => {
                setLinkDraft(event.target.value);
                setLinkError("");
              }}
              placeholder="https://example.com"
              className={`${formControlClassName} mt-0 min-w-0 flex-1 text-sm`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applyLink}
                className="rounded-full bg-[#cf5f2b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b94f22]"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkPanelOpen(false);
                  setLinkDraft("");
                  setLinkError("");
                }}
                className="rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
          {linkError ? <p className="mt-2 text-sm font-medium text-[#b42318]">{linkError}</p> : null}
        </div>
      ) : null}

      {composerError ? <FormError className="mt-3">{composerError}</FormError> : null}

      <p className="mt-3 text-xs leading-5 text-[#67564c]">
        Images up to 10MB. Videos up to 250MB. Links must use HTTP or HTTPS.
      </p>
    </form>
  );
}
