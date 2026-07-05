import { redirect } from "next/navigation";
import {
  getCurrentAuthUser,
  getCurrentProfile as getCanonicalCurrentProfile,
  getCurrentProfileForUser as getCanonicalProfileForUser,
} from "@/lib/auth/current";
import { logRequestEvent } from "@/lib/observability/request";

export type PlatformProfile = {
  id: string;
  user_id: string;
  display_name: string;
  role: "user" | "platform_engineer";
};

export async function getCurrentUserOrRedirect() {
  return getCurrentAuthUser();
}

export async function getCurrentProfileForUser(user: Awaited<ReturnType<typeof getCurrentUserOrRedirect>>) {
  return getCanonicalProfileForUser(user) as Promise<PlatformProfile>;
}

export async function getCurrentProfile() {
  return getCanonicalCurrentProfile() as Promise<PlatformProfile>;
}

export async function requirePlatformEngineer() {
  const profile = await getCurrentProfile();

  if (profile.role !== "platform_engineer") {
    await logRequestEvent("warn", "authorization.platform.denied", {
      operation: "require_platform_engineer",
      role: profile.role,
      outcome: "denied",
    });
    redirect("/dashboard?message=Platform engineer access is required.");
  }

  return profile;
}

export async function isCurrentUserPlatformEngineer() {
  const user = await getCurrentUserOrRedirect();
  const profile = await getCurrentProfileForUser(user);
  return profile.role === "platform_engineer";
}
