import { MEDIA_LIMITS, formatBytes } from "@/lib/media/validation";
import { toLocalInputValue } from "@/lib/media/library";

type MediaItemFormProps = {
  action: (formData: FormData) => Promise<void>;
  communityId: string;
  returnTo: string;
  submitLabel: string;
  item?: {
    id: string;
    title: string;
    description: string | null;
    media_type: "sermon" | "teaching" | "testimony" | "resource" | "announcement";
    content_kind: "link" | "audio" | "video" | "document" | "text";
    external_url: string | null;
    scripture_reference: string | null;
    speaker_name: string | null;
    published_at: string | null;
    is_published: boolean;
    file_name: string | null;
  } | null;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

const mediaTypeOptions = [
  { value: "sermon", label: "Sermon" },
  { value: "teaching", label: "Teaching" },
  { value: "testimony", label: "Testimony" },
  { value: "resource", label: "Resource" },
  { value: "announcement", label: "Announcement" },
] as const;

const contentKindOptions = [
  { value: "text", label: "Text" },
  { value: "link", label: "Link" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "document", label: "Document" },
] as const;

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  placeholder,
}: Readonly<{
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
}>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#3b312b]">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue || ""}
        placeholder={placeholder}
        className={inputClassName}
      />
    </label>
  );
}

export function MediaItemForm({
  action,
  communityId,
  returnTo,
  submitLabel,
  item = null,
}: Readonly<MediaItemFormProps>) {
  return (
    <form action={action} encType="multipart/form-data" className="space-y-5">
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="return_to" value={returnTo} />
      {item ? <input type="hidden" name="media_id" value={item.id} /> : null}

      <Field label="Title" name="title" defaultValue={item?.title} required placeholder="Sermon title" />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Media type</span>
          <select name="media_type" defaultValue={item?.media_type || "sermon"} className={inputClassName}>
            {mediaTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Content kind</span>
          <select name="content_kind" defaultValue={item?.content_kind || "text"} className={inputClassName}>
            {contentKindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Description or notes</span>
        <textarea
          name="description"
          rows={5}
          defaultValue={item?.description || ""}
          className={inputClassName}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="External URL"
          name="external_url"
          type="url"
          defaultValue={item?.external_url}
          placeholder="https://..."
        />
        <Field
          label="Scripture reference"
          name="scripture_reference"
          defaultValue={item?.scripture_reference}
          placeholder="John 3:16"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Speaker or author" name="speaker_name" defaultValue={item?.speaker_name} placeholder="Pastor name" />
        <Field
          label="Published at"
          name="published_at"
          type="datetime-local"
          defaultValue={toLocalInputValue(item?.published_at)}
        />
      </div>

      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">
          File upload
        </span>
        <input name="media_file" type="file" className={`${inputClassName} pt-2`} />
      </label>
      <p className="text-sm leading-6 text-[#67564c]">
        Audio: MP3, M4A, WAV up to {formatBytes(MEDIA_LIMITS.communityAudioBytes)}. Video: MP4, WebM, MOV up to{" "}
        {formatBytes(MEDIA_LIMITS.betaVideoBytes)}. Documents: PDF, DOC, DOCX up to{" "}
        {formatBytes(MEDIA_LIMITS.communityDocumentBytes)}.
      </p>

      <label className="flex items-center gap-3 text-sm font-medium text-[#3b312b]">
        <input name="is_published" type="checkbox" defaultChecked={item?.is_published ?? true} className="h-4 w-4" />
        Publish immediately
      </label>

      {item?.file_name ? (
        <p className="text-sm text-[#67564c]">Current file: {item.file_name}</p>
      ) : null}

      <button type="submit" className="rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
        {submitLabel}
      </button>
    </form>
  );
}
