"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  MEDIA_LIMITS,
  PROFILE_AVATAR_BUCKET,
  validateImageFile,
} from "@/lib/media/validation";

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
    .select("id,user_id,display_name,username,bio,favorite_verse,church_name,avatar_url")
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
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
      username: nullableFormString(formData, "username"),
      bio: nullableFormString(formData, "bio"),
      favorite_verse: nullableFormString(formData, "favorite_verse"),
      church_name: nullableFormString(formData, "church_name"),
      avatar_url: nullableFormString(formData, "avatar_url"),
    })
    .eq("user_id", user.id);

  if (error) {
    redirect(`/profile?message=${encodeURIComponent(error.message)}`);
  }

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      display_name: displayName,
    },
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect("/profile?message=Profile updated.");
}

export async function uploadCurrentUserAvatar(formData: FormData) {
  const user = await getCurrentUser();
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    redirect("/profile?message=Choose an image to upload.");
  }

  const validation = validateImageFile(file, { maxBytes: MEDIA_LIMITS.avatarImageBytes });

  if (!validation.ok) {
    redirect(`/profile?message=${encodeURIComponent(validation.message || "Invalid image.")}`);
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${extension}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(PROFILE_AVATAR_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    redirect(`/profile?message=${encodeURIComponent(uploadError.message)}`);
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(path);

  const { error } = await admin
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("user_id", user.id);

  if (error) {
    redirect(`/profile?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect("/profile?message=Profile photo updated.");
}
