import { MEDIA_LIMITS, formatBytes } from "@/lib/media/validation";
import {
  ActionButton,
  FormActions,
  FormField,
  FormHint,
  FormLabel,
  FormSection,
  formControlClassName,
} from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";

type CommunityPostFormProps = {
  action: (formData: FormData) => Promise<void>;
  communityId: string;
  returnTo: string;
  submitLabel: string;
  showPublishToggle?: boolean;
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

export function CommunityPostForm({
  action,
  communityId,
  returnTo,
  submitLabel,
  showPublishToggle = true,
  post = null,
}: Readonly<CommunityPostFormProps>) {
  return (
    <form action={action} encType="multipart/form-data">
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="return_to" value={returnTo} />
      {post ? <input type="hidden" name="post_id" value={post.id} /> : null}

      <FormSection title="Update content">
      <FormField>
        <FormLabel htmlFor="update-media-kind">Update type</FormLabel>
        <select id="update-media-kind" name="media_kind" defaultValue={post?.media_kind || "text"} className={formControlClassName}>
          <option value="text">Text</option>
          <option value="link">Link</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
      </FormField>

      <FormField>
        <FormLabel htmlFor="update-title">Title</FormLabel>
        <input id="update-title" name="title" maxLength={160} defaultValue={post?.title || ""} className={formControlClassName} />
      </FormField>

      <FormField>
        <FormLabel htmlFor="update-body">Body</FormLabel>
        <textarea id="update-body" name="body" rows={6} maxLength={10000} defaultValue={post?.body || ""} className={formControlClassName} />
      </FormField>

      <FormField>
        <FormLabel htmlFor="update-media-url">Link URL</FormLabel>
        <input id="update-media-url" name="media_url" type="url" defaultValue={post?.media_url || ""} className={formControlClassName} />
      </FormField>
      </FormSection>

      <FormSection title="Media and publishing" className="mt-8 border-t border-[#ead6c5] pt-7">
      <FormField>
        <FormLabel htmlFor="update-media-file">Image or video upload</FormLabel>
        <input id="update-media-file" name="media_file" type="file" className={`${formControlClassName} pt-2`} />
        <FormHint>
          Images: JPG, PNG, WebP, GIF up to {formatBytes(MEDIA_LIMITS.postImageBytes)}. Videos: MP4, WebM, MOV up to{" "}
          {formatBytes(MEDIA_LIMITS.betaVideoBytes)}.
        </FormHint>
      </FormField>

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
        <SubmitButton pendingLabel={post ? "Saving update…" : "Publishing update…"}>{submitLabel}</SubmitButton>
      </FormActions>
    </form>
  );
}
