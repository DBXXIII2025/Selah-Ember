import { MEDIA_LIMITS, formatBytes } from "@/lib/media/validation";

type CommunityPostFormProps = {
  action: (formData: FormData) => Promise<void>;
  communityId: string;
  returnTo: string;
  submitLabel: string;
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

const inputClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

export function CommunityPostForm({
  action,
  communityId,
  returnTo,
  submitLabel,
  post = null,
}: Readonly<CommunityPostFormProps>) {
  return (
    <form action={action} encType="multipart/form-data" className="space-y-5">
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="return_to" value={returnTo} />
      {post ? <input type="hidden" name="post_id" value={post.id} /> : null}

      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Update type</span>
        <select name="media_kind" defaultValue={post?.media_kind || "text"} className={inputClassName}>
          <option value="text">Text</option>
          <option value="link">Link</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Title</span>
        <input name="title" maxLength={160} defaultValue={post?.title || ""} className={inputClassName} />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Body</span>
        <textarea name="body" rows={6} maxLength={10000} defaultValue={post?.body || ""} className={inputClassName} />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Link URL</span>
        <input name="media_url" type="url" defaultValue={post?.media_url || ""} className={inputClassName} />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Image or video upload</span>
        <input name="media_file" type="file" className={`${inputClassName} pt-2`} />
      </label>
      <p className="text-sm leading-6 text-[#67564c]">
        Images: JPG, PNG, WebP, GIF up to {formatBytes(MEDIA_LIMITS.postImageBytes)}. Videos: MP4, WebM, MOV up to{" "}
        {formatBytes(MEDIA_LIMITS.betaVideoBytes)}.
      </p>

      <label className="flex items-center gap-3 text-sm font-medium text-[#3b312b]">
        <input name="is_published" type="checkbox" defaultChecked={post?.is_published ?? true} className="h-4 w-4" />
        Publish
      </label>

      {post?.file_name ? <p className="text-sm text-[#67564c]">Current file: {post.file_name}</p> : null}

      <button type="submit" className="rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
        {submitLabel}
      </button>
    </form>
  );
}
