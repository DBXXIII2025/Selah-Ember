import type {
  StudyProgressStatus,
  StudyRoomMembershipMode,
  StudyRoomRole,
  StudyRoomStatus,
  StudyRoomVisibility,
  StudyStatus,
} from "@/lib/study-rooms/validation";

export function formatStudyRoomRole(role: StudyRoomRole | null) {
  if (!role) return "Not a member";
  return role[0].toUpperCase() + role.slice(1);
}

export function formatVisibility(value: StudyRoomVisibility) {
  if (value === "unlisted") return "Unlisted";
  return value[0].toUpperCase() + value.slice(1);
}

export function formatMembershipMode(value: StudyRoomMembershipMode) {
  if (value === "open_join") return "Open join";
  if (value === "request_to_join") return "Request to join";
  return "Invite only";
}

export function formatRoomStatus(value: StudyRoomStatus) {
  return value[0].toUpperCase() + value.slice(1);
}

export function formatStudyStatus(value: StudyStatus) {
  return value[0].toUpperCase() + value.slice(1);
}

export function formatProgressStatus(value: StudyProgressStatus) {
  if (value === "not_started") return "Not started";
  if (value === "in_progress") return "In progress";
  return "Completed";
}

export function formatDateTime(value: string | null) {
  if (!value) return null;

  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

export function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}
