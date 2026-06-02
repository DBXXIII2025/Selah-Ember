import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { getUnreadMessageCount } from "@/app/actions/messages";
import { getUnreadNotificationCount } from "@/app/actions/notifications";
import { BrandMark } from "@/components/ui/brand-mark";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-selah-pathname") || "";
  const isPublicGroupDetail = /^\/groups\/[^/]+$/.test(pathname);
  const isPublicEventDetail = /^\/events\/[^/]+$/.test(pathname);
  const isPublicCommunityFeed = pathname === "/community" || /^\/community\/posts\/[^/]+$/.test(pathname);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicGroupDetail && !isPublicEventDetail && !isPublicCommunityFeed) {
    redirect("/signin");
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f7ead7] text-[#211814]">
        <header className="border-b border-[#c8874d]/30 bg-[#151210]/95 text-[#fff4df] shadow-lg shadow-black/10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10 lg:px-16">
            <BrandMark variant="light" />
            <nav className="flex items-center gap-4 text-sm font-semibold text-[#d8bea3]">
              <Link href="/discover" className="transition hover:text-[#f0a35c]">
                Discover
              </Link>
              <Link href="/community" className="transition hover:text-[#f0a35c]">
                Community
              </Link>
              <Link href="/discover/groups" className="transition hover:text-[#f0a35c]">
                Groups
              </Link>
              <Link href="/events" className="transition hover:text-[#f0a35c]">
                Events
              </Link>
              <Link href="/signin" className="transition hover:text-[#f0a35c]">
                Sign in
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </main>
    );
  }

  const admin = createAdminClient();
  const displayName =
    typeof user.user_metadata.display_name === "string"
      ? user.user_metadata.display_name
      : user.email?.split("@")[0] || "Selah Ember Member";

  await admin.from("profiles").upsert(
    {
      user_id: user.id,
      display_name: displayName,
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: true,
    },
  );

  const [unreadNotificationCount, unreadMessageCount] = await Promise.all([
    getUnreadNotificationCount(),
    getUnreadMessageCount(),
  ]);
  const { data: currentProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const isPlatformEngineer = currentProfile?.role === "platform_engineer";

  return (
    <main className="min-h-screen bg-[#f7ead7] text-[#211814]">
      <header className="border-b border-[#c8874d]/30 bg-[#151210]/95 text-[#fff4df] shadow-lg shadow-black/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-16">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
            <BrandMark href="/dashboard" variant="light" />
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-[#d8bea3]">
              <Link href="/dashboard" className="transition hover:text-[#f0a35c]">
                Dashboard
              </Link>
              <Link href="/profile" className="transition hover:text-[#f0a35c]">
                Profile
              </Link>
              <Link href="/community" className="transition hover:text-[#f0a35c]">
                Community
              </Link>
              <Link href="/prayer" className="transition hover:text-[#f0a35c]">
                Prayer
              </Link>
              <Link href="/groups" className="transition hover:text-[#f0a35c]">
                Groups
              </Link>
              <Link href="/events" className="transition hover:text-[#f0a35c]">
                Events
              </Link>
              <Link href="/messages" className="transition hover:text-[#f0a35c]">
                Messages
                {unreadMessageCount > 0 ? ` (${unreadMessageCount})` : ""}
              </Link>
              <Link href="/notifications" className="transition hover:text-[#f0a35c]">
                Notifications
                {unreadNotificationCount > 0 ? ` (${unreadNotificationCount})` : ""}
              </Link>
              {isPlatformEngineer ? (
                <Link href="/platform" className="transition hover:text-[#f0a35c]">
                  Platform
                </Link>
              ) : null}
            </nav>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-[#c8874d]/45 px-4 py-2 text-sm font-semibold text-[#fff4df] transition hover:bg-[#fff4df]/10"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </main>
  );
}
