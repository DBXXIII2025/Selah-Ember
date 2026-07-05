"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getErrorMetadata } from "@/lib/observability/log";
import { logRequestEvent } from "@/lib/observability/request";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function getSignInErrorMessage(message: string) {
  return message.toLowerCase().includes("email not confirmed")
    ? "Please confirm your email before signing in."
    : message;
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
    await logRequestEvent("warn", "auth.signup.failed", {
      provider: "supabase",
      ...getErrorMetadata(error),
    });
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
  redirect("/community");
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
    await logRequestEvent("warn", "auth.signin.failed", {
      provider: "supabase",
      ...getErrorMetadata(error),
    });
    redirect(`/signin?message=${encodeURIComponent(getSignInErrorMessage(error.message))}`);
  }

  revalidatePath("/", "layout");
  redirect("/community");
}

export async function signOut() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/");
}
