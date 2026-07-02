import type { User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { getUnreadMessageCount } from "@/app/actions/messages";
import { getUnreadNotificationCount } from "@/app/actions/notifications";
import { BrandMark } from "@/components/ui/brand-mark";
import { PUBLIC_NAVIGATION_ITEMS, ResponsiveNavigation, type NavigationItem } from "@/components/ui/app-navigation";
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
  let user: User | null = null;

  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (error) {
    console.warn("[protected_layout] auth_unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!user && !isPublicGroupDetail && !isPublicEventDetail && !isPublicCommunityFeed) {
    redirect("/signin");
  }

  if (!user) {
    return (
      <div className="min-h-screen overflow-x-clip bg-[#f7ead7] text-[#211814]">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <header className="sticky top-0 z-40 border-b border-[#c8874d]/30 bg-[#151210]/95 text-[#fff4df] shadow-lg shadow-black/10 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3 sm:px-8 lg:px-16 lg:py-4">
            <BrandMark variant="light" />
            <ResponsiveNavigation items={PUBLIC_NAVIGATION_ITEMS} />
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div>
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
  const navigationItems: NavigationItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/community", label: "Community" },
    { href: "/prayer", label: "Prayer" },
    { href: "/groups", label: "Groups" },
    { href: "/events", label: "Events" },
    { href: "/messages", label: "Messages", count: unreadMessageCount },
    { href: "/notifications", label: "Notifications", count: unreadNotificationCount },
    { href: "/profile", label: "Profile" },
    ...(isPlatformEngineer ? [{ href: "/platform", label: "Platform" }] : []),
  ];

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f7ead7] text-[#211814]">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="sticky top-0 z-40 border-b border-[#c8874d]/30 bg-[#151210]/95 text-[#fff4df] shadow-lg shadow-black/10 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3 sm:px-8 lg:px-16 lg:py-4">
          <BrandMark href="/dashboard" variant="light" />
          <ResponsiveNavigation items={navigationItems} signOutAction={signOut} />
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
    </div>
  );
}
