"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuthAndProfile } from "@/lib/auth/current";
import { assertNotBanned } from "@/lib/moderation/bans";
import { isSafeHttpUrl, validateImageFile, validateVideoFile } from "@/lib/media/validation";
import { createAdminClient } from "@/lib/supabase/admin";

const COMMUNITY_FEED_BUCKET = "community-feed-media";
const MAX_TITLE_LENGTH = 160;
const MAX_BODY_LENGTH = 10000;

export type CommunityPost = {
  id: string;
  community_id: string;
  author_id: string;
  title: string | null;
  body: string | null;
  media_url: string | null;
  media_kind: "image" | "video" | "link" | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  signed_url: string | null;
};

type CommunityRecord = {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  is_published: boolean;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  return value.length > 0 ? value : null;
}

function safeReturnPath(path: string, fallback: string) {
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function getOptionalFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!(value instanceof File) || value.size <= 0 || !value.name) {
    return null;
  }

  return value;
}

function sanitizeFilename(name: string) {
  return (
    name
      .replace(/[/\\]/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 120) || "community-feed-media"
  );
}

function isMediaKind(value: string): value is "text" | "link" | "image" | "video" {
  return ["text", "link", "image", "video"].includes(value);
}

function mapCommunity(row: Record<string, unknown>): CommunityRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    created_by: typeof row.created_by === "string" ? row.created_by : null,
    is_published: row.is_published !== false,
  };
}

function mapPost(row: Record<string, unknown>): CommunityPost {
  const mediaKind =
    row.media_kind === "image" || row.media_kind === "video" || row.media_kind === "link" ? row.media_kind : null;

  return {
    id: String(row.id),
    community_id: String(row.community_id),
    author_id: String(row.author_id),
    title: typeof row.title === "string" ? row.title : null,
    body: typeof row.body === "string" ? row.body : null,
    media_url: typeof row.media_url === "string" ? row.media_url : null,
    media_kind: mediaKind,
    storage_path: typeof row.storage_path === "string" ? row.storage_path : null,
    file_name: typeof row.file_name === "string" ? row.file_name : null,
    mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
    size_bytes:
      typeof row.size_bytes === "number"
        ? row.size_bytes
        : typeof row.size_bytes === "string"
          ? Number(row.size_bytes)
          : null,
    is_published: row.is_published !== false,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
    signed_url: null,
  };
}

async function signPost(post: CommunityPost) {
  if (!post.storage_path) {
    return post;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(COMMUNITY_FEED_BUCKET).createSignedUrl(post.storage_path, 60 * 60);

  if (error) {
    return post;
  }

  return { ...post, signed_url: data.signedUrl };
}

async function signPosts(posts: CommunityPost[]) {
  return Promise.all(posts.map((post) => signPost(post)));
}

async function getCommunityForManager(communityId: string) {
  const { user, profile } = await getCurrentAuthAndProfile();
  await assertNotBanned(user.id);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("churches")
    .select("id,name,slug,created_by,is_published")
    .eq("id", communityId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { user, profile, community: null };
  }

  const community = mapCommunity(data as unknown as Record<string, unknown>);
  const isPlatformEngineer = profile.role === "platform_engineer";
  const isVerifiedOwner = profile.role === "church_leader" && community.created_by === profile.id;

  if (!isPlatformEngineer && !isVerifiedOwner) {
    return { user, profile, community: null };
  }

  return { user, profile, community };
}

async function getCommunityById(communityId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("churches")
    .select("id,name,slug,created_by,is_published")
    .eq("id", communityId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapCommunity(data as unknown as Record<string, unknown>) : null;
}

async function uploadPostMedia({ communityId, userId, file }: { communityId: string; userId: string; file: File }) {
  const path = `${communityId}/${userId}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(COMMUNITY_FEED_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  };
}

async function deleteStoredPostObject(path: string | null) {
  if (!path) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.storage.from(COMMUNITY_FEED_BUCKET).remove([path]);

  if (error) {
    console.warn("[community_posts] storage_delete_failed", { path, message: error.message });
  }
}

async function loadPostRows(communityId: string, publishedOnly: boolean) {
  const admin = createAdminClient();
  let query = admin
    .from("community_posts")
    .select("id,community_id,author_id,title,body,media_url,media_kind,storage_path,file_name,mime_type,size_bytes,is_published,created_at,updated_at,deleted_at")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });

  if (publishedOnly) {
    query = query.eq("is_published", true).is("deleted_at", null);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw new Error(error.message);
  }

  return signPosts(((data || []) as unknown as Record<string, unknown>[]).map(mapPost));
}

export async function getPublicCommunityPosts(communityId: string, limit = 3) {
  const rows = await loadPostRows(communityId, true);
  return rows.slice(0, limit);
}

export async function getCommunityPostsForLeader(communityId: string) {
  const access = await getCommunityForManager(communityId);

  if (!access.community) {
    return { community: null, posts: [] as CommunityPost[] };
  }

  return {
    community: access.community,
    posts: await loadPostRows(communityId, false),
  };
}

export async function getCommunityPostForLeader(communityId: string, postId: string) {
  const data = await getCommunityPostsForLeader(communityId);
  return {
    community: data.community,
    post: data.posts.find((post) => post.id === postId) || null,
  };
}

function validatePostInput({
  returnTo,
  title,
  body,
  kind,
  externalUrl,
  file,
  hasExistingMedia,
}: {
  returnTo: string;
  title: string | null;
  body: string | null;
  kind: "text" | "link" | "image" | "video";
  externalUrl: string | null;
  file: File | null;
  hasExistingMedia: boolean;
}) {
  if (title && title.length > MAX_TITLE_LENGTH) {
    redirect(`${returnTo}?message=Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
  }

  if (body && body.length > MAX_BODY_LENGTH) {
    redirect(`${returnTo}?message=Body must be ${MAX_BODY_LENGTH} characters or fewer.`);
  }

  if (!title && !body && !externalUrl && !file && !hasExistingMedia) {
    redirect(`${returnTo}?message=Add text, a link, or a media file.`);
  }

  if (kind === "text" && (externalUrl || file)) {
    redirect(`${returnTo}?message=Text updates do not use media or external links.`);
  }

  if (kind === "link") {
    if (!externalUrl) {
      redirect(`${returnTo}?message=Add a safe URL for link updates.`);
    }

    if (!isSafeHttpUrl(externalUrl)) {
      redirect(`${returnTo}?message=Add a valid HTTP or HTTPS link.`);
    }

    if (file) {
      redirect(`${returnTo}?message=Link updates do not use file uploads.`);
    }
  }

  if ((kind === "image" || kind === "video") && externalUrl) {
    redirect(`${returnTo}?message=Use file uploads for image and video updates.`);
  }

  if (file) {
    const validation = kind === "image" ? validateImageFile(file) : kind === "video" ? validateVideoFile(file) : null;

    if (!validation?.ok) {
      redirect(`${returnTo}?message=${encodeURIComponent(validation?.message || "Invalid upload.")}`);
    }
  }
}

export async function createCommunityPost(formData: FormData) {
  const communityId = getFormString(formData, "community_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/leader/communities/${communityId}/updates`);
  const title = nullableFormString(formData, "title");
  const body = nullableFormString(formData, "body");
  const kindInput = getFormString(formData, "media_kind") || "text";
  const externalUrl = nullableFormString(formData, "media_url");
  const file = getOptionalFile(formData, "media_file");
  const isPublished = formData.get("is_published") === "on";

  if (!communityId || !isMediaKind(kindInput)) {
    redirect(`${returnTo}?message=Choose a valid update type.`);
  }

  const { user, community } = await getCommunityForManager(communityId);

  if (!community) {
    redirect("/leader?message=Only verified community leaders can create official updates.");
  }

  validatePostInput({ returnTo, title, body, kind: kindInput, externalUrl, file, hasExistingMedia: false });

  let uploadedFile: Awaited<ReturnType<typeof uploadPostMedia>> | null = null;

  if (file) {
    uploadedFile = await uploadPostMedia({ communityId, userId: user.id, file });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("community_posts").insert({
    community_id: communityId,
    author_id: user.id,
    title,
    body,
    media_url: kindInput === "link" ? externalUrl : null,
    media_kind: kindInput === "text" ? null : kindInput,
    storage_path: uploadedFile?.storage_path || null,
    file_name: uploadedFile?.file_name || null,
    mime_type: uploadedFile?.mime_type || null,
    size_bytes: uploadedFile?.size_bytes || null,
    is_published: isPublished,
  });

  if (error) {
    await deleteStoredPostObject(uploadedFile?.storage_path || null);
    redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/leader/communities/${communityId}/updates`);
  revalidatePath(`/c/${community.slug}`);
  redirect(returnTo);
}

export async function updateCommunityPost(formData: FormData) {
  const postId = getFormString(formData, "post_id");
  const communityId = getFormString(formData, "community_id");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/leader/communities/${communityId}/updates`);
  const title = nullableFormString(formData, "title");
  const body = nullableFormString(formData, "body");
  const kindInput = getFormString(formData, "media_kind") || "text";
  const externalUrl = nullableFormString(formData, "media_url");
  const file = getOptionalFile(formData, "media_file");
  const isPublished = formData.get("is_published") === "on";

  if (!postId || !communityId || !isMediaKind(kindInput)) {
    redirect(`${returnTo}?message=Update not found.`);
  }

  const { user, community } = await getCommunityForManager(communityId);

  if (!community) {
    redirect("/leader?message=Only verified community leaders can edit official updates.");
  }

  const data = await getCommunityPostForLeader(communityId, postId);

  if (!data.post) {
    redirect(`${returnTo}?message=Update not found.`);
  }

  validatePostInput({
    returnTo,
    title,
    body,
    kind: kindInput,
    externalUrl,
    file,
    hasExistingMedia: Boolean(data.post.storage_path || data.post.media_url),
  });

  let uploadedFile: Awaited<ReturnType<typeof uploadPostMedia>> | null = null;

  if (file) {
    uploadedFile = await uploadPostMedia({ communityId, userId: user.id, file });
  }

  const nextStoragePath = kindInput === "image" || kindInput === "video" ? uploadedFile?.storage_path || data.post.storage_path : null;
  const nextFileName = kindInput === "image" || kindInput === "video" ? uploadedFile?.file_name || data.post.file_name : null;
  const nextMimeType = kindInput === "image" || kindInput === "video" ? uploadedFile?.mime_type || data.post.mime_type : null;
  const nextSizeBytes = kindInput === "image" || kindInput === "video" ? uploadedFile?.size_bytes || data.post.size_bytes : null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("community_posts")
    .update({
      title,
      body,
      media_url: kindInput === "link" ? externalUrl || data.post.media_url : null,
      media_kind: kindInput === "text" ? null : kindInput,
      storage_path: nextStoragePath,
      file_name: nextFileName,
      mime_type: nextMimeType,
      size_bytes: nextSizeBytes,
      is_published: isPublished,
    })
    .eq("id", postId);

  if (error) {
    await deleteStoredPostObject(uploadedFile?.storage_path || null);
    redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  }

  if (uploadedFile?.storage_path && data.post.storage_path && data.post.storage_path !== uploadedFile.storage_path) {
    await deleteStoredPostObject(data.post.storage_path);
  }

  revalidatePath(`/leader/communities/${communityId}/updates`);
  revalidatePath(`/leader/communities/${communityId}/updates/${postId}/edit`);
  revalidatePath(`/c/${community.slug}`);
  redirect(returnTo);
}

export async function deleteCommunityPost(formData: FormData) {
  const postId = getFormString(formData, "post_id");
  const communityId = getFormString(formData, "community_id");
  const confirmation = getFormString(formData, "confirmation");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), `/leader/communities/${communityId}/updates`);

  if (!postId || !communityId) {
    redirect(`${returnTo}?message=Update not found.`);
  }

  if (confirmation !== "DELETE") {
    redirect(`${returnTo}?message=Type DELETE to confirm update deletion.`);
  }

  const { community } = await getCommunityForManager(communityId);

  if (!community) {
    redirect("/leader?message=Only verified community leaders can delete official updates.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("community_posts")
    .update({ deleted_at: new Date().toISOString(), is_published: false })
    .eq("id", postId)
    .eq("community_id", communityId);

  if (error) {
    redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/leader/communities/${communityId}/updates`);
  revalidatePath(`/c/${community.slug}`);
  redirect(returnTo);
}

export async function getCommunityByIdForUpdates(communityId: string) {
  return getCommunityById(communityId);
}
