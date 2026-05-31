import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  user_id: string;
  display_name: string;
  username: string | null;
  role: string;
};

export type CurrentAuthAndProfile = {
  user: {
    id: string;
    email?: string | null;
    user_metadata: Record<string, unknown>;
  };
  profile: CurrentProfile;
};

async function getOptionalUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

async function getProfileForUser(user: NonNullable<Awaited<ReturnType<typeof getOptionalUser>>>) {
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
    .select("id,user_id,display_name,username,role")
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CurrentProfile;
}

export async function getCurrentAuthAndProfile(): Promise<CurrentAuthAndProfile> {
  const user = await getOptionalUser();

  if (!user) {
    redirect("/signin");
  }

  return {
    user,
    profile: await getProfileForUser(user),
  };
}

export async function getOptionalAuthAndProfile(): Promise<CurrentAuthAndProfile | null> {
  const user = await getOptionalUser();

  if (!user) {
    return null;
  }

  return {
    user,
    profile: await getProfileForUser(user),
  };
}

export async function getCurrentProfileForUser(
  user: NonNullable<Awaited<ReturnType<typeof getOptionalUser>>>,
) {
  return getProfileForUser(user);
}
