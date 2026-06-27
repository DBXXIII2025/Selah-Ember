import { MEDIA_LIMITS, formatBytes } from "@/lib/media/validation";
import { toLocalInputValue } from "@/lib/media/library";
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
    <FormField>
      <FormLabel htmlFor={`media-${name}`} required={required}>{label}</FormLabel>
      <input
        id={`media-${name}`}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue || ""}
        placeholder={placeholder}
        className={formControlClassName}
      />
    </FormField>
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
    <form action={action} encType="multipart/form-data">
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="return_to" value={returnTo} />
      {item ? <input type="hidden" name="media_id" value={item.id} /> : null}

      <FormSection title="Media details">
        <Field label="Title" name="title" defaultValue={item?.title} required placeholder="Media title" />

        <div className="grid gap-5 md:grid-cols-2">
          <FormField>
            <FormLabel htmlFor="media-type">Media type</FormLabel>
            <select id="media-type" name="media_type" defaultValue={item?.media_type || "sermon"} className={formControlClassName}>
            {mediaTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            </select>
          </FormField>
          <FormField>
            <FormLabel htmlFor="media-content-kind">Content kind</FormLabel>
            <select id="media-content-kind" name="content_kind" defaultValue={item?.content_kind || "text"} className={formControlClassName}>
            {contentKindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            </select>
          </FormField>
        </div>

        <FormField>
          <FormLabel htmlFor="media-description">Description or notes</FormLabel>
          <textarea id="media-description" name="description" rows={5} defaultValue={item?.description || ""} className={formControlClassName} />
        </FormField>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="External URL" name="external_url" type="url" defaultValue={item?.external_url} placeholder="https://..." />
          <Field label="Scripture reference" name="scripture_reference" defaultValue={item?.scripture_reference} placeholder="John 3:16" />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Speaker or author" name="speaker_name" defaultValue={item?.speaker_name} placeholder="Speaker name" />
          <Field label="Published at" name="published_at" type="datetime-local" defaultValue={toLocalInputValue(item?.published_at)} />
        </div>
      </FormSection>

      <FormSection title="File and publishing" className="mt-8 border-t border-[#ead6c5] pt-7">
        <FormField>
          <FormLabel htmlFor="media-file">File upload</FormLabel>
          <input id="media-file" name="media_file" type="file" className={`${formControlClassName} pt-2`} />
          <FormHint>
            Audio: MP3, M4A, WAV up to {formatBytes(MEDIA_LIMITS.communityAudioBytes)}. Video: MP4, WebM, MOV up to{" "}
            {formatBytes(MEDIA_LIMITS.betaVideoBytes)}. Documents: PDF, DOC, DOCX up to{" "}
            {formatBytes(MEDIA_LIMITS.communityDocumentBytes)}.
          </FormHint>
        </FormField>

        <label className="flex items-center gap-3 rounded-xl border border-[#d9c1ad] bg-[#fffaf4] px-4 py-3 text-sm font-semibold text-[#3b312b]">
          <input name="is_published" type="checkbox" defaultChecked={item?.is_published ?? true} className="h-4 w-4 accent-[#cf5f2b]" />
          Publish immediately
        </label>

        {item?.file_name ? <FormHint>Current file: {item.file_name}</FormHint> : null}
      </FormSection>

      <FormActions className="mt-7">
        <ActionButton href={returnTo} variant="secondary">Cancel</ActionButton>
        <SubmitButton pendingLabel={item ? "Saving changes…" : "Creating media…"}>{submitLabel}</SubmitButton>
      </FormActions>
    </form>
  );
}
