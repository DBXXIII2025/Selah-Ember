import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PlatformProfile = {
  id: string;
  user_id: string;
  display_name: string;
  role: "user" | "church_owner" | "platform_engineer";
};

export async function getCurrentUserOrRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  return user;
}

export async function getCurrentProfileForUser(user: Awaited<ReturnType<typeof getCurrentUserOrRedirect>>) {
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
    .select("id,user_id,display_name,role")
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as PlatformProfile;
}

export async function getCurrentProfile() {
  const user = await getCurrentUserOrRedirect();
  return getCurrentProfileForUser(user);
}

export async function requirePlatformEngineer() {
  const profile = await getCurrentProfile();

  if (profile.role !== "platform_engineer") {
    redirect("/dashboard?message=Platform engineer access is required.");
  }

  return profile;
}

export async function isCurrentUserPlatformEngineer() {
  const user = await getCurrentUserOrRedirect();
  const profile = await getCurrentProfileForUser(user);
  return profile.role === "platform_engineer";
}
