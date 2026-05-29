"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function signUp(formData: FormData) {
  const email = getFormString(formData, "email");
  const password = getFormString(formData, "password");
  const displayName = getFormString(formData, "displayName");

  if (!email || !password || !displayName) {
    redirect("/signup?message=Please complete every field.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
      emailRedirectTo: `${getAppUrl()}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/signup?message=${encodeURIComponent(error.message)}`);
  }

  if (data.user) {
    const admin = createAdminClient();
    await admin.from("profiles").upsert(
      {
        user_id: data.user.id,
        display_name: displayName,
      },
      {
        onConflict: "user_id",
      },
    );
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  const email = getFormString(formData, "email");
  const password = getFormString(formData, "password");

  if (!email || !password) {
    redirect("/signin?message=Please enter your email and password.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/signin?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/");
}
