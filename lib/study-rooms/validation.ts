export const STUDY_ROOM_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const STUDY_ROOM_LIMITS = {
  roomName: 120,
  roomDescription: 5000,
  coverImageUrl: 2048,
  studyTopic: 160,
  bibleBook: 80,
  scriptureReference: 160,
  studyTitle: 160,
  studyDescription: 10000,
  leaderNotes: 20000,
  closingReflection: 20000,
  joinRequestMessage: 1000,
  invitationMessage: 1000,
  noteTitle: 160,
  noteBody: 20000,
  discussionTitle: 160,
  discussionBody: 20000,
  discussionReplyBody: 20000,
  prayerTitle: 160,
  prayerBody: 10000,
  prayerAnsweredUpdate: 10000,
  resourceTitle: 160,
  resourceDescription: 5000,
  reportReason: 160,
  reportDetails: 1000,
  inviteSearch: 80,
};

export const STUDY_ROOM_VISIBILITIES = ["public", "private", "unlisted"] as const;
export const STUDY_ROOM_MEMBERSHIP_MODES = ["open_join", "request_to_join", "invite_only"] as const;
export const STUDY_ROOM_STATUSES = ["active", "completed", "archived"] as const;
export const STUDY_ROOM_ROLES = ["owner", "leader", "moderator", "member"] as const;
export const STUDY_STATUSES = ["draft", "upcoming", "active", "completed"] as const;
export const STUDY_PROGRESS_STATUSES = ["not_started", "in_progress", "completed"] as const;
export const STUDY_ROOM_NOTE_SORTS = ["newest", "oldest", "study"] as const;
export const STUDY_ROOM_PRAYER_CATEGORIES = ["praise", "healing", "family", "church", "work", "salvation", "other"] as const;
export const STUDY_ROOM_PRAYER_STATUSES = ["active", "answered"] as const;
export const STUDY_ROOM_RESOURCE_TYPES = ["article", "video", "study_guide", "pdf", "external_link", "other"] as const;
export const STUDY_ROOM_REPORT_TARGETS = ["note", "thread", "reply", "prayer", "resource"] as const;

export type StudyRoomVisibility = (typeof STUDY_ROOM_VISIBILITIES)[number];
export type StudyRoomMembershipMode = (typeof STUDY_ROOM_MEMBERSHIP_MODES)[number];
export type StudyRoomStatus = (typeof STUDY_ROOM_STATUSES)[number];
export type StudyRoomRole = (typeof STUDY_ROOM_ROLES)[number];
export type StudyStatus = (typeof STUDY_STATUSES)[number];
export type StudyProgressStatus = (typeof STUDY_PROGRESS_STATUSES)[number];
export type StudyRoomNoteSort = (typeof STUDY_ROOM_NOTE_SORTS)[number];
export type StudyRoomPrayerCategory = (typeof STUDY_ROOM_PRAYER_CATEGORIES)[number];
export type StudyRoomPrayerStatus = (typeof STUDY_ROOM_PRAYER_STATUSES)[number];
export type StudyRoomResourceType = (typeof STUDY_ROOM_RESOURCE_TYPES)[number];
export type StudyRoomReportTarget = (typeof STUDY_ROOM_REPORT_TARGETS)[number];

export function isStudyRoomUuid(value: string) {
  return STUDY_ROOM_UUID_PATTERN.test(value);
}

export function normalizeOptionalText(value: string, maxLength: number) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

export function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function getOptionalFormString(formData: FormData, key: string, maxLength: number) {
  return normalizeOptionalText(getFormString(formData, key), maxLength);
}

export function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function pickAllowedValue<const T extends readonly string[]>(
  value: string,
  allowed: T,
  fallback: T[number],
): T[number] {
  return allowed.includes(value) ? (value as T[number]) : fallback;
}

export function safeReturnPath(path: string, fallback: string) {
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}
