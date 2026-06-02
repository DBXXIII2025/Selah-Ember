"use server";

import { redirect } from "next/navigation";
import { requirePlatformEngineer } from "@/lib/platform/auth";

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
  updated_at: string;
};

export async function submitLeaderApplication() {
  redirect("/leader/apply?message=Leader verification is no longer required.");
}

export async function getMyLeaderApplications(): Promise<LeaderApplication[]> {
  return [];
}

export async function getLeaderApplicationsForPlatform(): Promise<LeaderApplication[]> {
  await requirePlatformEngineer();
  return [];
}

export async function reviewLeaderApplication() {
  await requirePlatformEngineer();
  redirect("/platform/leader-applications?message=Leader applications are no longer used.");
}
