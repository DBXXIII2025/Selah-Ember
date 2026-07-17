"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getErrorMetadata } from "@/lib/observability/log";
import { logRequestEvent } from "@/lib/observability/request";
import {
  MEDIA_LIMITS,
  PROFILE_AVATAR_BUCKET,
  validateImageFile,
} from "@/lib/media/validation";

const MESSAGE_MEDIA_BUCKET = "message-media";
const COMMUNITY_FEED_BUCKET = "community-feed-media";
const COMMUNITY_MEDIA_BUCKET = "community-media";

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

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function isStoragePath(value: string) {
  return !/^https?:\/\//i.test(value) && value.includes("/") && !value.includes("..");
}

async function removeStorageObjects(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  paths: string[],
) {
  const uniquePaths = uniqueValues(paths).filter(isStoragePath);

  for (let index = 0; index < uniquePaths.length; index += 100) {
    const chunk = uniquePaths.slice(index, index + 100);
    const { error } = await admin.storage.from(bucket).remove(chunk);

    if (error) {
      await logRequestEvent("error", "account_deletion.storage_delete.failed", {
        bucket,
        operation: "delete",
        ...getErrorMetadata(error),
      });
      throw new Error(`Could not remove ${bucket} files.`);
    }
  }
}

async function getAccountStoragePaths(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  profileId: string | null,
) {
  const paths: Record<string, string[]> = {
    [PROFILE_AVATAR_BUCKET]: [],
    [MESSAGE_MEDIA_BUCKET]: [],
    [COMMUNITY_FEED_BUCKET]: [],
    [COMMUNITY_MEDIA_BUCKET]: [],
  };

  const { data: avatars, error: avatarsError } = await admin.storage
    .from(PROFILE_AVATAR_BUCKET)
    .list(userId, { limit: 1000 });

  if (avatarsError) {
    await logRequestEvent("error", "account_deletion.storage_list.failed", {
      bucket: PROFILE_AVATAR_BUCKET,
      operation: "list",
      ...getErrorMetadata(avatarsError),
    });
    throw new Error("Could not inspect profile avatar files.");
  }

  paths[PROFILE_AVATAR_BUCKET] = (avatars || [])
    .filter((item) => item.name && item.name !== ".emptyFolderPlaceholder")
    .map((item) => `${userId}/${item.name}`);

  const { data: messageAttachments, error: messageAttachmentsError } = await admin
    .from("message_attachments")
    .select("url")
    .eq("uploader_id", userId);

  if (messageAttachmentsError) {
    throw new Error(messageAttachmentsError.message);
  }

  paths[MESSAGE_MEDIA_BUCKET] = uniqueValues(
    (messageAttachments || []).map((row) => (typeof row.url === "string" ? row.url : null)),
  );

  const { data: communityPosts, error: communityPostsError } = await admin
    .from("community_posts")
    .select("storage_path")
    .eq("author_id", userId)
    .not("storage_path", "is", null);

  if (communityPostsError) {
    throw new Error(communityPostsError.message);
  }

  paths[COMMUNITY_FEED_BUCKET] = uniqueValues(
    (communityPosts || []).map((row) => (typeof row.storage_path === "string" ? row.storage_path : null)),
  );

  if (profileId) {
    const { data: mediaItems, error: mediaItemsError } = await admin
      .from("media_items")
      .select("storage_path")
      .eq("created_by", profileId)
      .not("storage_path", "is", null);

    if (mediaItemsError) {
      throw new Error(mediaItemsError.message);
    }

    paths[COMMUNITY_MEDIA_BUCKET] = uniqueValues(
      (mediaItems || []).map((row) => (typeof row.storage_path === "string" ? row.storage_path : null)),
    );
  }

  return paths;
}

async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    await supabase.auth.signOut();
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
    await logRequestEvent("warn", "upload.validation.rejected", {
      bucket: PROFILE_AVATAR_BUCKET,
      reason: "file_validation_failed",
    });
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
    await logRequestEvent("error", "storage.upload.failed", {
      bucket: PROFILE_AVATAR_BUCKET,
      operation: "upload",
      ...getErrorMetadata(uploadError),
    });
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

export async function deleteCurrentUserAccount(formData: FormData) {
  const confirmation = getFormString(formData, "confirmation");

  if (confirmation !== "DELETE") {
    redirect("/profile?message=Type DELETE to confirm account deletion.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    await supabase.auth.signOut();
    redirect("/signin?message=Please sign in again before deleting your account.");
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    await logRequestEvent("error", "account_deletion.profile_lookup.failed", {
      operation: "delete_account",
      ...getErrorMetadata(profileError),
    });
    redirect(`/profile?message=${encodeURIComponent("Could not prepare account deletion.")}`);
  }

  try {
    const storagePaths = await getAccountStoragePaths(
      admin,
      user.id,
      typeof profile?.id === "string" ? profile.id : null,
    );

    const { data: deletionSummary, error: deletionError } = await admin.rpc("delete_user_account_data", {
      target_user_id: user.id,
    });

    if (deletionError) {
      await logRequestEvent("error", "account_deletion.database.failed", {
        operation: "delete_account",
        ...getErrorMetadata(deletionError),
      });
      throw new Error("Could not delete account data.");
    }

    await removeStorageObjects(admin, PROFILE_AVATAR_BUCKET, storagePaths[PROFILE_AVATAR_BUCKET]);
    await removeStorageObjects(admin, MESSAGE_MEDIA_BUCKET, storagePaths[MESSAGE_MEDIA_BUCKET]);
    await removeStorageObjects(admin, COMMUNITY_FEED_BUCKET, storagePaths[COMMUNITY_FEED_BUCKET]);
    await removeStorageObjects(admin, COMMUNITY_MEDIA_BUCKET, storagePaths[COMMUNITY_MEDIA_BUCKET]);

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      await logRequestEvent("error", "account_deletion.sign_out.failed", {
        provider: "supabase",
        operation: "delete_account",
        ...getErrorMetadata(signOutError),
      });
      throw new Error("Account data was removed, but the session could not be cleared. Contact support.");
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);

    if (authDeleteError) {
      await logRequestEvent("error", "account_deletion.auth_identity.failed", {
        provider: "supabase",
        operation: "delete_account",
        ...getErrorMetadata(authDeleteError),
      });
      throw new Error("Account data was removed, but the sign-in identity could not be deleted. Contact support.");
    }

    await logRequestEvent("info", "account_deletion.succeeded", {
      operation: "delete_account",
      profileCount: typeof deletionSummary === "object" && deletionSummary ? Number((deletionSummary as Record<string, unknown>).profiles || 0) : 0,
      avatarObjectCount: storagePaths[PROFILE_AVATAR_BUCKET].length,
      messageMediaObjectCount: storagePaths[MESSAGE_MEDIA_BUCKET].length,
      communityFeedObjectCount: storagePaths[COMMUNITY_FEED_BUCKET].length,
      communityMediaObjectCount: storagePaths[COMMUNITY_MEDIA_BUCKET].length,
    });
  } catch (error) {
    await logRequestEvent("error", "account_deletion.failed", {
      operation: "delete_account",
      ...getErrorMetadata(error),
    });
    redirect(`/profile?message=${encodeURIComponent(error instanceof Error ? error.message : "Could not delete account.")}`);
  }

  revalidatePath("/", "layout");
  redirect("/?message=Account%20deleted.");
}
