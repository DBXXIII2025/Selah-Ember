"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AuthError, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth/current";
import { getErrorMetadata } from "@/lib/observability/log";
import { logRequestEvent } from "@/lib/observability/request";
import { getSiteUrl } from "@/lib/site-url";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getAppUrl() {
  return getSiteUrl();
}

function getAuthErrorCode(error: AuthError) {
  return typeof error.code === "string" ? error.code : "";
}

function getSignInErrorMessage(error: AuthError) {
  const code = getAuthErrorCode(error);
  const message = error.message.toLowerCase();

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }

  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error.status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (code === "user_banned" || message.includes("banned") || message.includes("disabled")) {
    return "This account cannot sign in right now.";
  }

  if (error.status && error.status >= 500) {
    return "Authentication is temporarily unavailable. Please try again soon.";
  }

  return "We could not sign you in. Please check your details and try again.";
}

function isObfuscatedExistingUser(user: User | null) {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length === 0);
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

  if (isObfuscatedExistingUser(data.user)) {
    await logRequestEvent("warn", "auth.signup.existing_identity_obfuscated", {
      provider: "supabase",
      operation: "signup",
      outcome: "existing_identity",
    });
    redirect("/signin?message=If you already have an account, sign in with your existing password.");
  }

  if (data.user) {
    const admin = createAdminClient();
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        user_id: data.user.id,
        display_name: displayName,
      },
      {
        onConflict: "user_id",
      },
    );

    if (profileError) {
      await logRequestEvent("error", "auth.signup.profile_provision.failed", {
        provider: "supabase",
        operation: "signup",
        ...getErrorMetadata(profileError),
      });
      redirect("/signup?message=Your account was created, but your profile could not be prepared. Please contact support.");
    }
  }

  revalidatePath("/", "layout");
  if (data.session) {
    redirect("/community");
  }

  redirect("/signin?message=Check your email to confirm your account before signing in.");
}

export async function signIn(formData: FormData) {
  const email = getFormString(formData, "email");
  const password = getFormString(formData, "password");

  if (!email || !password) {
    redirect("/signin?message=Please enter your email and password.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await logRequestEvent("warn", "auth.signin.failed", {
      provider: "supabase",
      ...getErrorMetadata(error),
    });
    redirect(`/signin?message=${encodeURIComponent(getSignInErrorMessage(error))}`);
  }

  if (!data.session || !data.user) {
    await logRequestEvent("error", "auth.signin.session_missing", {
      provider: "supabase",
      operation: "signin",
      outcome: "session_missing",
    });
    redirect("/signin?message=We could not create a secure session. Please try again.");
  }

  if (!data.user.email_confirmed_at && !data.user.confirmed_at) {
    await supabase.auth.signOut();
    await logRequestEvent("warn", "auth.signin.unconfirmed_session_rejected", {
      provider: "supabase",
      operation: "signin",
      outcome: "unconfirmed",
    });
    redirect("/signin?message=Please confirm your email before signing in.");
  }

  try {
    await ensureProfileForUser(data.user);
  } catch (profileError) {
    await logRequestEvent("error", "auth.signin.profile_provision.failed", {
      provider: "supabase",
      operation: "signin",
      ...getErrorMetadata(profileError),
    });
    redirect("/signin?message=Your email is verified, but your profile could not be prepared. Please contact support.");
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
