export const PROFILE_AVATAR_BUCKET = "profile-avatars";

export const MEDIA_LIMITS = {
  avatarImageBytes: 5 * 1024 * 1024,
  postImageBytes: 10 * 1024 * 1024,
  communityAudioBytes: 100 * 1024 * 1024,
  communityDocumentBytes: 25 * 1024 * 1024,
  betaVideoBytes: 250 * 1024 * 1024,
  allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  allowedImageExtensions: ["jpg", "jpeg", "png", "webp", "gif"],
  allowedAudioMimeTypes: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"],
  allowedAudioExtensions: ["mp3", "m4a", "wav"],
  allowedVideoMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
  allowedVideoExtensions: ["mp4", "webm", "mov"],
  allowedDocumentMimeTypes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  allowedDocumentExtensions: ["pdf", "doc", "docx"],
};

const externalVideoHosts = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "vimeo.com",
  "www.vimeo.com",
  "drive.google.com",
];

export type MediaValidationResult = {
  ok: boolean;
  message?: string;
};

export function formatBytes(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toLocaleString("en-US", { maximumFractionDigits: 0 })}MB`;
}

function getExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

export function validateImageFile(
  file: File,
  options: { maxBytes?: number } = {},
): MediaValidationResult {
  const maxBytes = options.maxBytes || MEDIA_LIMITS.postImageBytes;

  if (!MEDIA_LIMITS.allowedImageMimeTypes.includes(file.type)) {
    return { ok: false, message: "Use a JPG, PNG, WebP, or GIF image." };
  }

  if (!MEDIA_LIMITS.allowedImageExtensions.includes(getExtension(file.name))) {
    return { ok: false, message: "Image filenames must end in JPG, PNG, WebP, or GIF." };
  }

  if (file.size <= 0) {
    return { ok: false, message: "Choose a non-empty image file." };
  }

  if (file.size > maxBytes) {
    return { ok: false, message: `Image uploads are limited to ${formatBytes(maxBytes)}.` };
  }

  return { ok: true };
}

export function validateVideoFile(file: File): MediaValidationResult {
  if (!MEDIA_LIMITS.allowedVideoMimeTypes.includes(file.type)) {
    return { ok: false, message: "Use an MP4, WebM, or MOV video." };
  }

  if (!MEDIA_LIMITS.allowedVideoExtensions.includes(getExtension(file.name))) {
    return { ok: false, message: "Video filenames must end in MP4, WebM, or MOV." };
  }

  if (file.size <= 0) {
    return { ok: false, message: "Choose a non-empty video file." };
  }

  if (file.size > MEDIA_LIMITS.betaVideoBytes) {
    return {
      ok: false,
      message: `Beta video uploads are limited to ${formatBytes(MEDIA_LIMITS.betaVideoBytes)}. Use an external video link for larger files.`,
    };
  }

  return { ok: true };
}

export function validateAudioFile(file: File): MediaValidationResult {
  if (!MEDIA_LIMITS.allowedAudioMimeTypes.includes(file.type)) {
    return { ok: false, message: "Use an MP3, M4A, or WAV audio file." };
  }

  if (!MEDIA_LIMITS.allowedAudioExtensions.includes(getExtension(file.name))) {
    return { ok: false, message: "Audio filenames must end in MP3, M4A, or WAV." };
  }

  if (file.size <= 0) {
    return { ok: false, message: "Choose a non-empty audio file." };
  }

  if (file.size > MEDIA_LIMITS.communityAudioBytes) {
    return {
      ok: false,
      message: `Audio uploads are limited to ${formatBytes(MEDIA_LIMITS.communityAudioBytes)}.`,
    };
  }

  return { ok: true };
}

export function validateDocumentFile(file: File): MediaValidationResult {
  if (!MEDIA_LIMITS.allowedDocumentMimeTypes.includes(file.type)) {
    return { ok: false, message: "Use a PDF, DOC, or DOCX document." };
  }

  if (!MEDIA_LIMITS.allowedDocumentExtensions.includes(getExtension(file.name))) {
    return { ok: false, message: "Document filenames must end in PDF, DOC, or DOCX." };
  }

  if (file.size <= 0) {
    return { ok: false, message: "Choose a non-empty document." };
  }

  if (file.size > MEDIA_LIMITS.communityDocumentBytes) {
    return {
      ok: false,
      message: `Document uploads are limited to ${formatBytes(MEDIA_LIMITS.communityDocumentBytes)}.`,
    };
  }

  return { ok: true };
}

export function parseSafeUrl(value: string) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function isSafeHttpUrl(value: string) {
  return Boolean(parseSafeUrl(value));
}

export function isSupportedExternalVideoUrl(value: string) {
  const url = parseSafeUrl(value);

  if (!url) {
    return false;
  }

  return externalVideoHosts.includes(url.hostname.toLowerCase());
}
