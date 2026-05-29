"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CurrentUserProfile = {
  id: string;
  user_id: string;
  display_name: string;
  username: string | null;
  bio: string | null;
  favorite_verse: string | null;
  church_name: string | null;
  avatar_url: string | null;
};

type ProfileRow = {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  username?: string | null;
  favorite_verse?: string | null;
  church_name?: string | null;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  return value.length > 0 ? value : null;
}

async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  return user;
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile> {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const fallbackDisplayName =
    typeof user.user_metadata.display_name === "string"
      ? user.user_metadata.display_name
      : user.email?.split("@")[0] || "Selah Ember Member";

  const { error: upsertError } = await admin
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: fallbackDisplayName,
      },
      {
        onConflict: "user_id",
        ignoreDuplicates: true,
      },
    )
    .select("id")
    .maybeSingle();

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id,user_id,display_name,bio,avatar_url")
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const profile = data as ProfileRow;

  return {
    id: profile.id,
    user_id: profile.user_id,
    display_name: profile.display_name,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    username: profile.username ?? getMetadataString(user.user_metadata, "username"),
    favorite_verse:
      profile.favorite_verse ?? getMetadataString(user.user_metadata, "favorite_verse"),
    church_name: profile.church_name ?? getMetadataString(user.user_metadata, "church_name"),
  };
}

export async function updateCurrentUserProfile(formData: FormData) {
  const user = await getCurrentUser();
  const displayName = getFormString(formData, "display_name");

  if (!displayName) {
    redirect("/profile?message=Display name is required.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      display_name: displayName,
      bio: nullableFormString(formData, "bio"),
      avatar_url: nullableFormString(formData, "avatar_url"),
    })
    .eq("user_id", user.id);

  if (error) {
    redirect(`/profile?message=${encodeURIComponent(error.message)}`);
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      display_name: displayName,
      username: nullableFormString(formData, "username"),
      favorite_verse: nullableFormString(formData, "favorite_verse"),
      church_name: nullableFormString(formData, "church_name"),
    },
  });

  if (metadataError) {
    redirect(`/profile?message=${encodeURIComponent(metadataError.message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect("/profile?message=Profile updated.");
}
