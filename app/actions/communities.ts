"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  banner_url: string | null;
  created_by: string | null;
};

export type CommunityMembership = {
  role: string;
  community: Community;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  return value.length > 0 ? value : null;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "community"
  );
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

async function getCurrentProfile() {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const displayName =
    typeof user.user_metadata.display_name === "string"
      ? user.user_metadata.display_name
      : user.email?.split("@")[0] || "Selah Ember Member";

  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      user_id: user.id,
      display_name: displayName,
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: true,
    },
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id,user_id,display_name")
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getAvailableSlug(name: string) {
  const admin = createAdminClient();
  const baseSlug = slugify(name);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await admin.from("churches").select("id").eq("slug", slug).maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return slug;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function createCommunity(formData: FormData) {
  const name = getFormString(formData, "name");

  if (!name) {
    redirect("/communities/new?message=Community name is required.");
  }

  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const slug = await getAvailableSlug(name);

  const { data: community, error } = await admin
    .from("churches")
    .insert({
      name,
      slug,
      description: nullableFormString(formData, "description"),
      location: nullableFormString(formData, "location"),
      banner_url: nullableFormString(formData, "banner_url"),
      created_by: profile.id,
      is_published: true,
    })
    .select("id,name,slug,description,location,banner_url,created_by")
    .single();

  if (error) {
    redirect(`/communities/new?message=${encodeURIComponent(error.message)}`);
  }

  await admin.from("church_memberships").upsert(
    {
      church_id: community.id,
      profile_id: profile.id,
      role: "owner",
    },
    {
      onConflict: "church_id,profile_id",
    },
  );

  revalidatePath("/communities");
  revalidatePath(`/c/${community.slug}`);
  redirect("/communities");
}

export async function getCurrentUserCommunities(): Promise<CommunityMembership[]> {
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("church_memberships")
    .select(
      "role, churches:church_id(id,name,slug,description,location,banner_url,created_by)",
    )
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || [])
    .filter((membership) => membership.churches)
    .map((membership) => ({
      role: membership.role,
      community: membership.churches as unknown as Community,
    }));
}

export async function getPublicCommunityBySlug(slug: string): Promise<Community | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("churches")
    .select("id,name,slug,description,location,banner_url,created_by")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
