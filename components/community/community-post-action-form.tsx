"use client";

import { useActionState, useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Paperclip, X } from "lucide-react";
import { MEDIA_LIMITS, formatBytes } from "@/lib/media/validation";
import type { CommunityPostFormState } from "@/app/actions/community-posts";
import {
  ActionButton,
  FormActions,
  FormError,
  FormField,
  FormHint,
  FormLabel,
  FormSection,
  formControlClassName,
} from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";

type CommunityPostActionFormProps = {
  action: (state: CommunityPostFormState, formData: FormData) => Promise<CommunityPostFormState>;
  communityId: string;
  returnTo: string;
  submitLabel: string;
  showPublishToggle?: boolean;
  topicSlug?: string | null;
  post?: {
    id: string;
    title: string | null;
    body: string | null;
    media_url: string | null;
    media_kind: "image" | "video" | "link" | null;
    file_name: string | null;
    is_published: boolean;
  } | null;
};

type SelectedAttachment = {
  name: string;
  size: number;
  type: string;
  previewUrl: string | null;
};

const initialState: CommunityPostFormState = { status: "idle", message: "" };

function inferKindFromFile(file: File) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("en-US", { maximumFractionDigits: 1 })}KB`;
  return formatBytes(bytes);
}

export function CommunityPostActionForm({
  action,
  communityId,
  returnTo,
  submitLabel,
  showPublishToggle = true,
  topicSlug = null,
  post = null,
}: Readonly<CommunityPostActionFormProps>) {
  const [state, formAction] = useActionState(action, initialState);
  const [mediaKind, setMediaKind] = useState(post?.media_kind || "text");
  const [title, setTitle] = useState(post?.title || "");
  const [body, setBody] = useState(post?.body || "");
  const [mediaUrl, setMediaUrl] = useState(post?.media_url || "");
  const [attachment, setAttachment] = useState<SelectedAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const attachmentId = useId();

  useEffect(() => {
    return () => {
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    };
  }, [attachment]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] || null;

    if (!file) {
      setAttachment(null);
      return;
    }

    const inferredKind = inferKindFromFile(file);
    setAttachment({
      name: file.name,
      size: file.size,
      type: file.type || "Unknown type",
      previewUrl: inferredKind === "image" ? URL.createObjectURL(file) : null,
    });

    if (inferredKind && mediaKind === "text") {
      setMediaKind(inferredKind);
    }
  }

  function removeSelectedAttachment() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setAttachment(null);
    if (!post?.media_kind) {
      setMediaKind("text");
    }
  }

  return (
    <form action={formAction} aria-describedby={state.status === "error" ? errorId : undefined} noValidate>
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="return_to" value={returnTo} />
      {topicSlug ? <input type="hidden" name="topic_slug" value={topicSlug} /> : null}
      {post ? <input type="hidden" name="post_id" value={post.id} /> : null}

      {state.status === "error" ? (
        <div id={errorId} className="mb-6">
          <FormError>{state.message}</FormError>
        </div>
      ) : null}

      <FormSection title="Update content">
        <FormField>
          <FormLabel htmlFor="update-media-kind">Update type</FormLabel>
          <select
            id="update-media-kind"
            name="media_kind"
            value={mediaKind}
            onChange={(event) => setMediaKind(event.currentTarget.value as "text" | "link" | "image" | "video")}
            className={formControlClassName}
          >
            <option value="text">Text</option>
            <option value="link">Link</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </FormField>

        <FormField>
          <FormLabel htmlFor="update-title">Title</FormLabel>
          <input
            id="update-title"
            name="title"
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            className={formControlClassName}
          />
        </FormField>

        <FormField>
          <FormLabel htmlFor="update-body">Body</FormLabel>
          <textarea
            id="update-body"
            name="body"
            rows={6}
            maxLength={10000}
            value={body}
            onChange={(event) => setBody(event.currentTarget.value)}
            className={formControlClassName}
          />
        </FormField>

        <FormField>
          <FormLabel htmlFor="update-media-url">Link URL</FormLabel>
          <input
            id="update-media-url"
            name="media_url"
            type="url"
            value={mediaUrl}
            onChange={(event) => setMediaUrl(event.currentTarget.value)}
            className={formControlClassName}
          />
        </FormField>
      </FormSection>

      <FormSection title="Media and publishing" className="mt-8 border-t border-[#ead6c5] pt-7">
        <FormField>
          <FormLabel htmlFor="update-media-file">Image or video upload</FormLabel>
          <input
            ref={fileInputRef}
            id="update-media-file"
            name="media_file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            onChange={handleFileChange}
            aria-describedby={attachmentId}
            className={`${formControlClassName} pt-2`}
          />
          <FormHint>
            Images: JPG, PNG, WebP, GIF up to {formatBytes(MEDIA_LIMITS.postImageBytes)}. Videos: MP4, WebM, MOV up to{" "}
            {formatBytes(MEDIA_LIMITS.betaVideoBytes)}.
          </FormHint>
        </FormField>

        {attachment ? (
          <div id={attachmentId} className="rounded-xl border border-[#d9c1ad] bg-[#fffaf4] p-3" aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#3b312b]">
                  <Paperclip aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="truncate">{attachment.name}</span>
                </p>
                <p className="mt-1 text-xs text-[#67564c]">
                  {attachment.type} - {formatAttachmentSize(attachment.size)}
                </p>
              </div>
              <ActionButton type="button" variant="secondary" size="sm" onClick={removeSelectedAttachment} className="shrink-0">
                <X aria-hidden="true" className="h-4 w-4" />
                Remove
              </ActionButton>
            </div>
            {attachment.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attachment.previewUrl} alt="Selected attachment preview" className="mt-3 max-h-72 w-full rounded-lg object-contain" />
            ) : null}
          </div>
        ) : null}

        {showPublishToggle ? (
          <label className="flex items-center gap-3 rounded-xl border border-[#d9c1ad] bg-[#fffaf4] px-4 py-3 text-sm font-semibold text-[#3b312b]">
            <input name="is_published" type="checkbox" defaultChecked={post?.is_published ?? true} className="h-4 w-4 accent-[#a94720]" />
            Publish
          </label>
        ) : null}

        {post?.file_name ? <FormHint>Current file: {post.file_name}</FormHint> : null}
      </FormSection>

      <FormActions className="mt-7">
        <ActionButton href={returnTo} variant="secondary">Cancel</ActionButton>
        <SubmitButton pendingLabel={post ? "Saving update..." : "Publishing update..."}>{submitLabel}</SubmitButton>
      </FormActions>
    </form>
  );
}
