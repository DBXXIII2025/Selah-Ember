import "server-only";

import { redirect } from "next/navigation";
import { getCurrentAuthAndProfile, getOptionalAuthAndProfile } from "@/lib/auth/current";
import { assertNotBanned } from "@/lib/moderation/bans";
import { logRequestEvent } from "@/lib/observability/request";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type StudyRoomMembershipMode,
  type StudyRoomRole,
  type StudyRoomStatus,
  type StudyRoomVisibility,
  isStudyRoomUuid,
} from "@/lib/study-rooms/validation";

export type StudyRoomAuthProfile = {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
};

export type StudyRoomRecord = {
  id: string;
  name: string;
  visibility: StudyRoomVisibility;
  membership_mode: StudyRoomMembershipMode;
  status: StudyRoomStatus;
  owner_profile_id: string | null;
};

export type StudyRoomAccess = {
  isSignedIn: boolean;
  profile: StudyRoomAuthProfile | null;
  room: StudyRoomRecord | null;
  role: StudyRoomRole | null;
  isMember: boolean;
  canRead: boolean;
  canManage: boolean;
  canLead: boolean;
  canModerate: boolean;
  isPlatformEngineer: boolean;
};

const roomSelect = "id,name,visibility,membership_mode,status,owner_profile_id";

function normalizeRoom(row: Record<string, unknown>): StudyRoomRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    visibility: row.visibility === "private" || row.visibility === "unlisted" ? row.visibility : "public",
    membership_mode:
      row.membership_mode === "request_to_join" || row.membership_mode === "invite_only"
        ? row.membership_mode
        : "open_join",
    status: row.status === "completed" || row.status === "archived" ? row.status : "active",
    owner_profile_id: typeof row.owner_profile_id === "string" ? row.owner_profile_id : null,
  };
}

function profileFromAuth(result: Awaited<ReturnType<typeof getCurrentAuthAndProfile>>): StudyRoomAuthProfile {
  return {
    id: result.profile.id,
    user_id: result.profile.user_id,
    display_name: result.profile.display_name,
    role: result.profile.role,
  };
}

export async function getOptionalStudyRoomProfile() {
  const result = await getOptionalAuthAndProfile();
  return result ? profileFromAuth(result) : null;
}

export async function getRequiredStudyRoomProfile(redirectTo = "/signin") {
  const result = await getCurrentAuthAndProfile();
  const profile = profileFromAuth(result);
  await assertNotBanned(profile.user_id, redirectTo);
  return profile;
}

export async function getStudyRoomAccess(roomId: string): Promise<StudyRoomAccess> {
  if (!isStudyRoomUuid(roomId)) {
    return {
      isSignedIn: false,
      profile: null,
      room: null,
      role: null,
      isMember: false,
      canRead: false,
      canManage: false,
      canLead: false,
      canModerate: false,
      isPlatformEngineer: false,
    };
  }

  const profile = await getOptionalStudyRoomProfile();
  const admin = createAdminClient();
  const [{ data: roomRow, error: roomError }, { data: membership, error: membershipError }] = await Promise.all([
    admin.from("study_rooms").select(roomSelect).eq("id", roomId).maybeSingle(),
    profile
      ? admin
          .from("study_room_members")
          .select("role")
          .eq("room_id", roomId)
          .eq("profile_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (roomError) {
    throw new Error(roomError.message);
  }

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!roomRow) {
    return {
      isSignedIn: Boolean(profile),
      profile,
      room: null,
      role: null,
      isMember: false,
      canRead: false,
      canManage: false,
      canLead: false,
      canModerate: false,
      isPlatformEngineer: profile?.role === "platform_engineer",
    };
  }

  const room = normalizeRoom(roomRow as unknown as Record<string, unknown>);
  const role = typeof membership?.role === "string" ? (membership.role as StudyRoomRole) : null;
  const isMember = Boolean(role);
  const isPlatformEngineer = profile?.role === "platform_engineer";
  const isPubliclyReadable = room.visibility !== "private" && room.status !== "archived";
  const canRead = isPlatformEngineer || isMember || isPubliclyReadable;
  const canLead = isPlatformEngineer || role === "owner" || role === "leader";
  const canModerate = canLead || role === "moderator";
  const canManage = isPlatformEngineer || role === "owner";

  return {
    isSignedIn: Boolean(profile),
    profile,
    room,
    role,
    isMember,
    canRead,
    canManage,
    canLead,
    canModerate,
    isPlatformEngineer: Boolean(isPlatformEngineer),
  };
}

export async function requireStudyRoomAccess(roomId: string) {
  const access = await getStudyRoomAccess(roomId);

  if (!access.canRead) {
    redirect(access.isSignedIn ? "/study-rooms?message=Study room unavailable." : "/signin");
  }

  return access;
}

export async function requireStudyRoomMembership(roomId: string) {
  const access = await requireStudyRoomAccess(roomId);

  if (!access.isMember && !access.isPlatformEngineer) {
    redirect(`/study-rooms/${roomId}?message=Join this Study Room to participate.`);
  }

  return access;
}

export async function requireStudyRoomLeader(roomId: string) {
  const access = await requireStudyRoomMembership(roomId);

  if (!access.canLead) {
    await logRequestEvent("warn", "authorization.study_room.leader.denied", {
      operation: "require_study_room_leader",
      resourceType: "study_room",
      outcome: "denied",
    });
    redirect(`/study-rooms/${roomId}?message=Only Study Room leaders can do that.`);
  }

  return access;
}

export async function requireStudyRoomModerator(roomId: string) {
  const access = await requireStudyRoomMembership(roomId);

  if (!access.canModerate) {
    await logRequestEvent("warn", "authorization.study_room.moderator.denied", {
      operation: "require_study_room_moderator",
      resourceType: "study_room",
      outcome: "denied",
    });
    redirect(`/study-rooms/${roomId}?message=Only Study Room moderators can do that.`);
  }

  return access;
}

export async function requireStudyRoomOwner(roomId: string) {
  const access = await requireStudyRoomMembership(roomId);

  if (!access.canManage) {
    await logRequestEvent("warn", "authorization.study_room.owner.denied", {
      operation: "require_study_room_owner",
      resourceType: "study_room",
      outcome: "denied",
    });
    redirect(`/study-rooms/${roomId}?message=Only the Study Room owner can do that.`);
  }

  return access;
}
