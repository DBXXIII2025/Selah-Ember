"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuthAndProfile } from "@/lib/auth/current";
import { assertNotBanned } from "@/lib/moderation/bans";
import { requirePlatformEngineer } from "@/lib/platform/auth";
import { isSafeHttpUrl } from "@/lib/media/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export type LeaderApplication = {
  id: string;
  profile_id: string;
  church_name: string;
  website_url: string | null;
  church_email: string | null;
  social_url: string | null;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  applicant: {
    display_name: string;
    user_id: string;
    role: string;
  } | null;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  return value.length > 0 ? value : null;
}

function safeApplicationUrl(value: string | null, fieldName: string) {
  if (!value) {
    return null;
  }

  if (!isSafeHttpUrl(value)) {
    redirect(`/leader/apply?message=${encodeURIComponent(`${fieldName} must be a valid HTTP or HTTPS URL.`)}`);
  }

  return value;
}

function normalizeApplication(row: Record<string, unknown>): LeaderApplication {
  const profile = row.profiles as { display_name?: string; user_id?: string; role?: string } | null | undefined;
  const status = row.status === "approved" || row.status === "rejected" ? row.status : "pending";

  return {
    id: String(row.id),
    profile_id: String(row.profile_id),
    church_name: String(row.church_name),
    website_url: typeof row.website_url === "string" ? row.website_url : null,
    church_email: typeof row.church_email === "string" ? row.church_email : null,
    social_url: typeof row.social_url === "string" ? row.social_url : null,
    description: typeof row.description === "string" ? row.description : null,
    status,
    reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    created_at: String(row.created_at),
    applicant: profile
      ? {
          display_name: String(profile.display_name || "Unknown applicant"),
          user_id: String(profile.user_id || ""),
          role: typeof profile.role === "string" ? profile.role : "user",
        }
      : null,
  };
}

export async function getMyLeaderApplications() {
  const { profile } = await getCurrentAuthAndProfile();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leader_applications")
    .select("id,profile_id,church_name,website_url,church_email,social_url,description,status,reviewed_by,reviewed_at,created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw new Error(error.message);
  }

  return ((data || []) as unknown as Record<string, unknown>[]).map(normalizeApplication);
}

export async function submitLeaderApplication(formData: FormData) {
  const { profile } = await getCurrentAuthAndProfile();
  await assertNotBanned(profile.user_id);

  const churchName = getFormString(formData, "church_name");

  if (!churchName) {
    redirect("/leader/apply?message=Church or ministry name is required.");
  }

  const admin = createAdminClient();
  const payload = {
    profile_id: profile.id,
    church_name: churchName,
    website_url: safeApplicationUrl(nullableFormString(formData, "website_url"), "Website URL"),
    church_email: nullableFormString(formData, "church_email"),
    social_url: safeApplicationUrl(nullableFormString(formData, "social_url"), "Social URL"),
    description: nullableFormString(formData, "description"),
    status: "pending",
  };

  const { error } = await admin.from("leader_applications").insert(payload);

  if (error) {
    redirect(`/leader/apply?message=${encodeURIComponent(error.message)}`);
  }

  if (profile.role !== "platform_engineer" && profile.role !== "church_leader") {
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role: "church_leader_pending" })
      .eq("id", profile.id)
      .neq("role", "platform_engineer");

    if (roleError) {
      redirect(`/leader/apply?message=${encodeURIComponent(roleError.message)}`);
    }
  }

  revalidatePath("/leader/apply");
  revalidatePath("/platform");
  revalidatePath("/platform/leader-applications");
  redirect("/leader/apply?message=Leader application submitted. You can draft a community while verification is pending.");
}

export async function getLeaderApplicationsForPlatform() {
  await requirePlatformEngineer();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leader_applications")
    .select("id,profile_id,church_name,website_url,church_email,social_url,description,status,reviewed_by,reviewed_at,created_at,profiles:profile_id(display_name,user_id,role)")
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw new Error(error.message);
  }

  return ((data || []) as unknown as Record<string, unknown>[]).map(normalizeApplication);
}

async function reviewLeaderApplication(formData: FormData, status: "approved" | "rejected") {
  const reviewer = await requirePlatformEngineer();
  const applicationId = getFormString(formData, "application_id");

  if (!applicationId) {
    redirect("/platform/leader-applications?message=Application not found.");
  }

  const admin = createAdminClient();
  const { data: application, error: lookupError } = await admin
    .from("leader_applications")
    .select("id,profile_id,profiles:profile_id(user_id)")
    .eq("id", applicationId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!application) {
    redirect("/platform/leader-applications?message=Application not found.");
  }

  const profileId = String(application.profile_id);
  const targetUserId = (application as unknown as { profiles?: { user_id?: string } | null }).profiles?.user_id;

  if (targetUserId === reviewer.user_id && status === "rejected") {
    redirect("/platform/leader-applications?message=You cannot demote yourself through an application review.");
  }

  const { error: updateError } = await admin
    .from("leader_applications")
    .update({
      status,
      reviewed_by: reviewer.user_id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (updateError) {
    redirect(`/platform/leader-applications?message=${encodeURIComponent(updateError.message)}`);
  }

  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: status === "approved" ? "church_leader" : "user" })
    .eq("id", profileId)
    .neq("role", "platform_engineer");

  if (roleError) {
    redirect(`/platform/leader-applications?message=${encodeURIComponent(roleError.message)}`);
  }

  revalidatePath("/platform");
  revalidatePath("/platform/leader-applications");
  redirect(`/platform/leader-applications?message=Application ${status}.`);
}

export async function approveLeaderApplication(formData: FormData) {
  await reviewLeaderApplication(formData, "approved");
}

export async function rejectLeaderApplication(formData: FormData) {
  await reviewLeaderApplication(formData, "rejected");
}
