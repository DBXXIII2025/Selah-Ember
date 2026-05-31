export type MediaType = "sermon" | "teaching" | "testimony" | "resource" | "announcement";
export type ContentKind = "link" | "audio" | "video" | "document" | "text";

export function mediaTypeLabel(value: MediaType) {
  return {
    sermon: "Sermon",
    teaching: "Teaching",
    testimony: "Testimony",
    resource: "Resource",
    announcement: "Announcement",
  }[value];
}

export function contentKindLabel(value: ContentKind) {
  return {
    link: "Link",
    audio: "Audio",
    video: "Video",
    document: "Document",
    text: "Text",
  }[value];
}

export function toLocalInputValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}
