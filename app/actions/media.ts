"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotification } from "@/app/actions/notifications";
import { getPublicCommunityBySlug } from "@/app/actions/communities";
import { getCurrentAuthAndProfile } from "@/lib/auth/current";
import { canCreateEvent } from "@/lib/auth/ownership";
import { assertNotBanned } from "@/lib/moderation/bans";
import { type ContentKind, type MediaType } from "@/lib/media/library";
import {
  isSafeHttpUrl,
  validateAudioFile,
  validateDocumentFile,
  validateVideoFile,
} from "@/lib/media/validation";
import { createAdminClient } from "@/lib/supabase/admin";

const MEDIA_BUCKET = "community-media";
const MEDIA_MAX_TITLE_LENGTH = 160;
const MEDIA_MAX_DESCRIPTION_LENGTH = 5000;

type Profile = {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
};

export type MediaCommunity = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  created_by: string | null;
  is_published: boolean;
};

export type MediaItem = {
  id: string;
  community_id: string;
  created_by: string;
  title: string;
  description: string | null;
  media_type: MediaType;
  content_kind: ContentKind;
  external_url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  scripture_reference: string | null;
  speaker_name: string | null;
  published_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  signed_url: string | null;
  community: MediaCommunity;
};

export type MediaLibraryData = {
  community: MediaCommunity | null;
  items: MediaItem[];
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

function sanitizeFilename(name: string) {
  return (
    name
      .replace(/[/\\]/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 120) || "community-media"
  );
}

function previewText(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
}

function normalizeCommunityFromPublic(
  community: Awaited<ReturnType<typeof getPublicCommunityBySlug>>,
): MediaCommunity | null {
  if (!community) {
    return null;
  }

  return {
    id: community.id,
    name: community.name,
    slug: community.slug,
    description: community.description,
    banner_url: community.banner_url,
    created_by: community.created_by,
    is_published: true,
  };
}

function normalizeDateTimeInput(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function getOptionalFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!(value instanceof File) || value.size <= 0 || !value.name) {
    return null;
  }

  return value;
}

function isMediaType(value: string): value is MediaType {
  return ["sermon", "teaching", "testimony", "resource", "announcement"].includes(value);
}

function isContentKind(value: string): value is ContentKind {
  return ["link", "audio", "video", "document", "text"].includes(value);
}

async function getCurrentProfile() {
  const { user, profile } = await getCurrentAuthAndProfile();
  return { user, profile: profile as Profile };
}

async function getCommunityForManager(communityId: string, profile: Profile) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("churches")
    .select("id,name,slug,description,banner_url,created_by,is_published")
    .eq("id", communityId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const community = {
    id: String(data.id),
    name: String(data.name),
    slug: typeof data.slug === "string" ? data.slug : "",
    description: typeof data.description === "string" ? data.description : null,
    banner_url: typeof data.banner_url === "string" ? data.banner_url : null,
    created_by: typeof data.created_by === "string" ? data.created_by : null,
    is_published: data.is_published !== false,
  };

  if (!(await canCreateEvent(communityId, { profile }))) {
    return null;
  }

  return community;
}

async function signMediaItem(item: Omit<MediaItem, "signed_url" | "community"> & { community: MediaCommunity }) {
  if (!item.storage_path) {
    return { ...item, signed_url: null };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(item.storage_path, 60 * 60);

  if (error) {
    return { ...item, signed_url: null };
  }

  return { ...item, signed_url: data.signedUrl };
}

function mapMediaRow(row: Record<string, unknown>, community: MediaCommunity) {
  return {
    id: String(row.id),
    community_id: String(row.community_id),
    created_by: String(row.created_by),
    title: String(row.title),
    description: typeof row.description === "string" ? row.description : null,
    media_type: isMediaType(String(row.media_type)) ? (row.media_type as MediaType) : "resource",
    content_kind: isContentKind(String(row.content_kind)) ? (row.content_kind as ContentKind) : "link",
    external_url: typeof row.external_url === "string" ? row.external_url : null,
    storage_path: typeof row.storage_path === "string" ? row.storage_path : null,
    file_name: typeof row.file_name === "string" ? row.file_name : null,
    mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
    size_bytes:
      typeof row.size_bytes === "number"
        ? row.size_bytes
        : typeof row.size_bytes === "string"
          ? Number(row.size_bytes)
          : null,
    scripture_reference: typeof row.scripture_reference === "string" ? row.scripture_reference : null,
    speaker_name: typeof row.speaker_name === "string" ? row.speaker_name : null,
    published_at: typeof row.published_at === "string" ? row.published_at : null,
    is_published: row.is_published !== false,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: typeof row.deleted_at === "string" ? row.deleted_at : null,
    signed_url: null,
    community,
  };
}

async function signMediaRows(rows: ReturnType<typeof mapMediaRow>[]) {
  return Promise.all(rows.map((row) => signMediaItem(row)));
}

async function notifyCommunityMembers(
  community: MediaCommunity,
  actorUserId: string,
  mediaItem: MediaItem,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("church_memberships")
    .select("profiles:profile_id(user_id)")
    .eq("church_id", community.id);

  if (error) {
    throw new Error(error.message);
  }

  const recipientUserIds = Array.from(
    new Set(
      ((data || []) as unknown as Record<string, unknown>[])
        .map((row) => {
          const profile = row.profiles as { user_id?: string } | null | undefined;
          return typeof profile?.user_id === "string" ? profile.user_id : null;
        })
        .filter((userId): userId is string => Boolean(userId) && userId !== actorUserId),
    ),
  );

  if (recipientUserIds.length === 0) {
    return;
  }

  await Promise.all(
    recipientUserIds.map((userId) =>
      createNotification({
        userId,
        actorUserId,
        type: "community_media_published",
        title: `New media from ${community.name}`,
        body: previewText(mediaItem.title),
        href: `/c/${community.slug}/media/${mediaItem.id}`,
      }),
    ),
  );
}

async function uploadCommunityMediaFile({
  communityId,
  userId,
  file,
}: {
  communityId: string;
  userId: string;
  file: File;
}) {
  const path = `${communityId}/${userId}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(MEDIA_BUCKET).upload(path, file, {
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

async function deleteStoredMediaObject(path: string | null) {
  if (!path) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.storage.from(MEDIA_BUCKET).remove([path]);

  if (error) {
    console.warn("[media] storage_delete_failed", { path, code: error.name, message: error.message });
  }
}

async function loadCommunityMediaRows(community: MediaCommunity, publishedOnly: boolean) {
  const admin = createAdminClient();
  let query = admin
    .from("media_items")
    .select(
      "id,community_id,created_by,title,description,media_type,content_kind,external_url,storage_path,file_name,mime_type,size_bytes,scripture_reference,speaker_name,published_at,is_published,created_at,updated_at,deleted_at",
    )
    .eq("community_id", community.id)
    .order("created_at", { ascending: false });

  if (publishedOnly) {
    query = query.eq("is_published", true).is("deleted_at", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data || []) as unknown as Record<string, unknown>[]).map((row) => mapMediaRow(row, community));
  return signMediaRows(rows);
}

async function loadCommunityMediaBySlug(communitySlug: string, mediaId?: string, publishedOnly = true) {
  const community = normalizeCommunityFromPublic(await getPublicCommunityBySlug(communitySlug));

  if (!community) {
    return { community: null, item: null, items: [] as MediaItem[] };
  }

  const items = await loadCommunityMediaRows(community, publishedOnly);

  if (!mediaId) {
    return { community, items, item: null };
  }

  const item = items.find((row) => row.id === mediaId) || null;

  return { community, items, item };
}

function validateMediaSource(contentKind: ContentKind, file: File | null, externalUrl: string | null) {
  if (contentKind === "text") {
    if (file || externalUrl) {
      return "Text items do not use file uploads or external URLs.";
    }

    return null;
  }

  if (contentKind === "link") {
    if (!externalUrl) {
      return "Add a safe external URL for link items.";
    }

    if (file) {
      return "Link items do not use file uploads.";
    }

    if (!isSafeHttpUrl(externalUrl)) {
      return "Add a valid HTTP or HTTPS link.";
    }

    return null;
  }

  if (file && externalUrl) {
    return "Use either a file upload or an external URL, not both.";
  }

  if (!file && !externalUrl) {
    return `Add a file upload or a safe external URL for ${contentKind} items.`;
  }

  if (externalUrl && !isSafeHttpUrl(externalUrl)) {
    return "Add a valid HTTP or HTTPS link.";
  }

  return null;
}

function validateUploadedFile(contentKind: ContentKind, file: File) {
  if (contentKind === "audio") {
    return validateAudioFile(file);
  }

  if (contentKind === "video") {
    return validateVideoFile(file);
  }

  if (contentKind === "document") {
    return validateDocumentFile(file);
  }

  return {
    ok: false,
    message: "Use text or link items without uploads, or choose audio/video/document for uploads.",
  };
}

async function requireMediaManager(communityId: string) {
  const { user, profile } = await getCurrentProfile();
  await assertNotBanned(user.id);

  const admin = createAdminClient();
  const { data: community, error } = await admin
    .from("churches")
    .select("id,name,slug,description,banner_url,created_by,is_published")
    .eq("id", communityId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!community) {
    return { user, profile, community: null };
  }

  const communityRecord = {
    id: String(community.id),
    name: String(community.name),
    slug: String(community.slug),
    description: typeof community.description === "string" ? community.description : null,
    banner_url: typeof community.banner_url === "string" ? community.banner_url : null,
    created_by: typeof community.created_by === "string" ? community.created_by : null,
    is_published: community.is_published !== false,
  };

  if (!(await canCreateEvent(communityId, { profile }))) {
    return { user, profile, community: null };
  }

  return { user, profile, community: communityRecord };
}

async function ensureMediaItemManager(mediaId: string, profile: Profile) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("media_items")
    .select("id,community_id,created_by,title,description,media_type,content_kind,external_url,storage_path,file_name,mime_type,size_bytes,scripture_reference,speaker_name,published_at,is_published,created_at,updated_at,deleted_at")
    .eq("id", mediaId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const communityAccess = await getCommunityForManager(String(data.community_id), profile);

  if (!communityAccess) {
    return null;
  }

  const community = communityAccess;
  const row = mapMediaRow(data as unknown as Record<string, unknown>, community);

  return { community, media: await signMediaItem(row) };
}

export async function getCommunityMedia(communitySlug: string): Promise<MediaLibraryData> {
  const community = normalizeCommunityFromPublic(await getPublicCommunityBySlug(communitySlug));

  if (!community) {
    return { community: null, items: [] };
  }

  const items = await loadCommunityMediaRows(community, true);
  return { community, items };
}

export async function getMediaItem(communitySlug: string, mediaId: string) {
  const { community, item } = await loadCommunityMediaBySlug(communitySlug, mediaId, true);
  return { community, item };
}

export async function getOwnedCommunityMediaForLeader(communityId: string): Promise<MediaLibraryData> {
  const { profile } = await getCurrentAuthAndProfile();
  const community = await getCommunityForManager(communityId, profile as Profile);

  if (!community) {
    return { community: null, items: [] };
  }

  const items = await loadCommunityMediaRows(community, false);
  return { community, items };
}

export async function createMediaItem(formData: FormData) {
  const communityId = getFormString(formData, "community_id");
  const returnTo = safeReturnPath(
    getFormString(formData, "return_to"),
    `/leader/communities/${communityId}/media`,
  );
  const title = getFormString(formData, "title");
  const description = nullableFormString(formData, "description");
  const mediaType = getFormString(formData, "media_type");
  const contentKind = getFormString(formData, "content_kind");
  const externalUrl = nullableFormString(formData, "external_url");
  const scriptureReference = nullableFormString(formData, "scripture_reference");
  const speakerName = nullableFormString(formData, "speaker_name");
  const publishedAtInput = nullableFormString(formData, "published_at");
  const isPublished = formData.get("is_published") === "on";
  const file = getOptionalFile(formData, "media_file");

  if (!communityId) {
    redirect("/leader?message=Choose a community first.");
  }

  if (!title) {
    redirect(`${returnTo}?message=Title is required.`);
  }

  if (!isMediaType(mediaType) || !isContentKind(contentKind)) {
    redirect(`${returnTo}?message=Choose a valid media type and content type.`);
  }

  if (title.length > MEDIA_MAX_TITLE_LENGTH) {
    redirect(`${returnTo}?message=Title must be ${MEDIA_MAX_TITLE_LENGTH} characters or fewer.`);
  }

  if (description && description.length > MEDIA_MAX_DESCRIPTION_LENGTH) {
    redirect(`${returnTo}?message=Description must be ${MEDIA_MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }

  const { user, profile, community } = await requireMediaManager(communityId);

  if (!community) {
    redirect("/leader?message=You can only add media to communities you lead.");
  }

  const sourceValidationError = validateMediaSource(contentKind, file, externalUrl);

  if (sourceValidationError) {
    redirect(`${returnTo}?message=${encodeURIComponent(sourceValidationError)}`);
  }

  let uploadedFile:
    | {
        storage_path: string;
        file_name: string;
        mime_type: string;
        size_bytes: number;
      }
    | null = null;

  if (file) {
    const uploadValidation = validateUploadedFile(contentKind, file);

    if (!uploadValidation.ok) {
      redirect(`${returnTo}?message=${encodeURIComponent(uploadValidation.message || "Invalid file.")}`);
    }

    uploadedFile = await uploadCommunityMediaFile({
      communityId,
      userId: user.id,
      file,
    });
  }

  const admin = createAdminClient();
  const publishedAt = isPublished ? normalizeDateTimeInput(publishedAtInput) || new Date().toISOString() : null;
  const { data: created, error } = await admin
    .from("media_items")
    .insert({
      community_id: communityId,
      created_by: profile.id,
      title,
      description,
      media_type: mediaType,
      content_kind: contentKind,
      external_url: externalUrl,
      storage_path: uploadedFile?.storage_path || null,
      file_name: uploadedFile?.file_name || null,
      mime_type: uploadedFile?.mime_type || null,
      size_bytes: uploadedFile?.size_bytes || null,
      scripture_reference: scriptureReference,
      speaker_name: speakerName,
      published_at: publishedAt,
      is_published: isPublished,
    })
    .select(
      "id,community_id,created_by,title,description,media_type,content_kind,external_url,storage_path,file_name,mime_type,size_bytes,scripture_reference,speaker_name,published_at,is_published,created_at,updated_at,deleted_at",
    )
    .single();

  if (error) {
    if (uploadedFile?.storage_path) {
      await deleteStoredMediaObject(uploadedFile.storage_path);
    }

    redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  }

  const media = await signMediaItem(
    mapMediaRow(created as unknown as Record<string, unknown>, community),
  );

  if (community.created_by === profile.id && isPublished) {
    await notifyCommunityMembers(community, user.id, media);
  }

  revalidatePath("/leader");
  revalidatePath(`/leader/communities/${communityId}`);
  revalidatePath(`/leader/communities/${communityId}/media`);
  revalidatePath(`/c/${community.slug}`);
  revalidatePath(`/c/${community.slug}/media`);
  revalidatePath(`/c/${community.slug}/media/${media.id}`);
  revalidatePath("/platform");

  redirect(returnTo);
}

export async function updateMediaItem(formData: FormData) {
  const mediaId = getFormString(formData, "media_id");
  const communityId = getFormString(formData, "community_id");
  const returnTo = safeReturnPath(
    getFormString(formData, "return_to"),
    `/leader/communities/${communityId}/media`,
  );
  const title = getFormString(formData, "title");
  const description = nullableFormString(formData, "description");
  const mediaType = getFormString(formData, "media_type");
  const contentKind = getFormString(formData, "content_kind");
  const externalUrl = nullableFormString(formData, "external_url");
  const scriptureReference = nullableFormString(formData, "scripture_reference");
  const speakerName = nullableFormString(formData, "speaker_name");
  const publishedAtInput = nullableFormString(formData, "published_at");
  const isPublished = formData.get("is_published") === "on";
  const file = getOptionalFile(formData, "media_file");

  if (!mediaId || !communityId) {
    redirect("/leader?message=Media item not found.");
  }

  const { user, profile, community } = await requireMediaManager(communityId);

  if (!community) {
    redirect("/leader?message=You can only edit media for communities you lead.");
  }

  if (!title) {
    redirect(`${returnTo}?message=Title is required.`);
  }

  if (!isMediaType(mediaType) || !isContentKind(contentKind)) {
    redirect(`${returnTo}?message=Choose a valid media type and content type.`);
  }

  if (title.length > MEDIA_MAX_TITLE_LENGTH) {
    redirect(`${returnTo}?message=Title must be ${MEDIA_MAX_TITLE_LENGTH} characters or fewer.`);
  }

  if (description && description.length > MEDIA_MAX_DESCRIPTION_LENGTH) {
    redirect(`${returnTo}?message=Description must be ${MEDIA_MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }

  const current = await ensureMediaItemManager(mediaId, profile as Profile);

  if (!current) {
    redirect("/leader?message=Media item not found.");
  }

  const existing = current.media;

  let uploadedFile:
    | {
        storage_path: string;
        file_name: string;
        mime_type: string;
        size_bytes: number;
      }
    | null = null;

  if (file) {
    const uploadValidation = validateUploadedFile(contentKind, file);

    if (!uploadValidation.ok) {
      redirect(`${returnTo}?message=${encodeURIComponent(uploadValidation.message || "Invalid file.")}`);
    }

    uploadedFile = await uploadCommunityMediaFile({
      communityId,
      userId: user.id,
      file,
    });
  }

  let nextExternalUrl = existing.external_url;
  let nextStoragePath = existing.storage_path;
  let nextFileName = existing.file_name;
  let nextMimeType = existing.mime_type;
  let nextSizeBytes = existing.size_bytes;

  if (contentKind === "text") {
    if (file || externalUrl) {
      redirect(`${returnTo}?message=Text items do not use file uploads or external URLs.`);
    }

    nextExternalUrl = null;
    nextStoragePath = null;
    nextFileName = null;
    nextMimeType = null;
    nextSizeBytes = null;
  } else if (contentKind === "link") {
    if (file) {
      redirect(`${returnTo}?message=Link items do not use file uploads.`);
    }

    nextExternalUrl = externalUrl || existing.external_url;

    if (!nextExternalUrl || !isSafeHttpUrl(nextExternalUrl)) {
      redirect(`${returnTo}?message=Add a valid HTTP or HTTPS link.`);
    }

    nextStoragePath = null;
    nextFileName = null;
    nextMimeType = null;
    nextSizeBytes = null;
  } else if (file) {
    nextExternalUrl = null;
    nextStoragePath = uploadedFile?.storage_path || null;
    nextFileName = uploadedFile?.file_name || null;
    nextMimeType = uploadedFile?.mime_type || null;
    nextSizeBytes = uploadedFile?.size_bytes || null;
  } else if (externalUrl) {
    if (!isSafeHttpUrl(externalUrl)) {
      redirect(`${returnTo}?message=Add a valid HTTP or HTTPS link.`);
    }

    nextExternalUrl = externalUrl;
    nextStoragePath = null;
    nextFileName = null;
    nextMimeType = null;
    nextSizeBytes = null;
  } else if (!existing.external_url && !existing.storage_path) {
    redirect(`${returnTo}?message=Add a file upload or a safe external URL for ${contentKind} items.`);
  }

  const nextPublishedAt = isPublished
    ? existing.published_at || normalizeDateTimeInput(publishedAtInput) || new Date().toISOString()
    : existing.published_at;

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("media_items")
    .update({
      title,
      description,
      media_type: mediaType,
      content_kind: contentKind,
      external_url: nextExternalUrl,
      storage_path: nextStoragePath,
      file_name: nextFileName,
      mime_type: nextMimeType,
      size_bytes: nextSizeBytes,
      scripture_reference: scriptureReference,
      speaker_name: speakerName,
      published_at: nextPublishedAt,
      is_published: isPublished,
    })
    .eq("id", mediaId)
    .select(
      "id,community_id,created_by,title,description,media_type,content_kind,external_url,storage_path,file_name,mime_type,size_bytes,scripture_reference,speaker_name,published_at,is_published,created_at,updated_at,deleted_at",
    )
    .single();

  if (error) {
    if (uploadedFile?.storage_path) {
      await deleteStoredMediaObject(uploadedFile.storage_path);
    }

    redirect(`${returnTo}?message=${encodeURIComponent(error.message)}`);
  }

  if (existing.storage_path && nextStoragePath !== existing.storage_path) {
    await deleteStoredMediaObject(existing.storage_path);
  }

  if (!existing.is_published && isPublished && community.created_by === profile.id) {
    const media = await signMediaItem(
      mapMediaRow(updated as unknown as Record<string, unknown>, community),
    );

    await notifyCommunityMembers(community, user.id, media);
  }

  revalidatePath("/leader");
  revalidatePath(`/leader/communities/${communityId}`);
  revalidatePath(`/leader/communities/${communityId}/media`);
  revalidatePath(`/leader/communities/${communityId}/media/${mediaId}/edit`);
  revalidatePath(`/c/${community.slug}`);
  revalidatePath(`/c/${community.slug}/media`);
  revalidatePath(`/c/${community.slug}/media/${mediaId}`);
  revalidatePath("/platform");

  redirect(returnTo);
}

export async function deleteMediaItem(formData: FormData) {
  const mediaId = getFormString(formData, "media_id");
  const confirmation = getFormString(formData, "confirmation");
  const returnTo = safeReturnPath(getFormString(formData, "return_to"), "/leader");

  if (!mediaId) {
    redirect(`${returnTo}?message=Media item not found.`);
  }

  if (confirmation !== "DELETE") {
    redirect(`${returnTo}?message=Type DELETE to confirm media deletion.`);
  }

  const { profile } = await getCurrentAuthAndProfile();
  await assertNotBanned(profile.user_id);

  const admin = createAdminClient();
  const { data: existing, error } = await admin
    .from("media_items")
    .select("id,community_id,created_by,title,storage_path,deleted_at")
    .eq("id", mediaId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!existing) {
    redirect(`${returnTo}?message=Media item not found.`);
  }

  const { data: community, error: communityError } = await admin
    .from("churches")
    .select("id,name,slug,created_by")
    .eq("id", String(existing.community_id))
    .maybeSingle();

  if (communityError) {
    throw new Error(communityError.message);
  }

  if (!community) {
    redirect(`${returnTo}?message=Community not found.`);
  }

  if (!(await canCreateEvent(String(existing.community_id), { profile }))) {
    redirect(`${returnTo}?message=You can only delete media you manage.`);
  }

  const { error: updateError } = await admin
    .from("media_items")
    .update({ deleted_at: new Date().toISOString(), is_published: false })
    .eq("id", mediaId);

  if (updateError) {
    redirect(`${returnTo}?message=${encodeURIComponent(updateError.message)}`);
  }

  await deleteStoredMediaObject(typeof existing.storage_path === "string" ? existing.storage_path : null);

  revalidatePath("/leader");
  revalidatePath(`/leader/communities/${existing.community_id}`);
  revalidatePath(`/leader/communities/${existing.community_id}/media`);
  revalidatePath(`/c/${community.slug}`);
  revalidatePath(`/c/${community.slug}/media`);
  revalidatePath(`/c/${community.slug}/media/${mediaId}`);
  revalidatePath("/platform");

  redirect(returnTo);
}
