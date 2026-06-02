import { type CurrentAuthAndProfile, getCurrentAuthAndProfile } from "@/lib/auth/current";
import { createAdminClient } from "@/lib/supabase/admin";

export type OwnershipProfile = {
  id: string;
  user_id: string;
  role: string;
};

export type OwnershipContext =
  | CurrentAuthAndProfile
  | {
      profile: OwnershipProfile;
    };

async function getContext(context?: OwnershipContext) {
  return context || getCurrentAuthAndProfile();
}

export async function isCommunityOwner(communityId: string, context?: OwnershipContext) {
  const { profile } = await getContext(context);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("churches")
    .select("created_by")
    .eq("id", communityId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.created_by === "string" && data.created_by === profile.id;
}

export async function isCommunityMember(communityId: string, context?: OwnershipContext) {
  const { profile } = await getContext(context);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("church_memberships")
    .select("id")
    .eq("church_id", communityId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function isGroupOwner(groupId: string, context?: OwnershipContext) {
  const { profile } = await getContext(context);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("study_groups")
    .select("created_by")
    .eq("id", groupId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.created_by === "string" && data.created_by === profile.id;
}

export async function isGroupMember(groupId: string, context?: OwnershipContext) {
  const { profile } = await getContext(context);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("group_memberships")
    .select("id")
    .eq("group_id", groupId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function canManageCommunity(communityId: string, context?: OwnershipContext) {
  const auth = await getContext(context);

  return auth.profile.role === "platform_engineer";
}

export async function canManageGroup(groupId: string, context?: OwnershipContext) {
  const auth = await getContext(context);

  if (auth.profile.role === "platform_engineer") {
    return true;
  }

  if (await isGroupOwner(groupId, auth)) {
    return true;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("group_memberships")
    .select("role")
    .eq("group_id", groupId)
    .eq("profile_id", auth.profile.id)
    .in("role", ["owner", "leader"])
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export function canCreateCommunity(profile: Pick<OwnershipProfile, "role">) {
  return profile.role === "platform_engineer";
}

export async function canCreateEvent(communityId: string, context?: OwnershipContext) {
  const auth = await getContext(context);

  return auth.profile.role === "platform_engineer";
}
