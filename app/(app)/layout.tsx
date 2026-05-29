import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
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

  return (
    <main className="min-h-screen bg-[#fff8ed] text-[#211b17]">
      <header className="border-b border-[#ead6c5] bg-white/75">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10 lg:px-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-semibold">
              Selah Ember
            </Link>
            <nav className="flex items-center gap-4 text-sm font-semibold text-[#67564c]">
              <Link href="/dashboard" className="transition hover:text-[#b94f22]">
                Dashboard
              </Link>
              <Link href="/profile" className="transition hover:text-[#b94f22]">
                Profile
              </Link>
              <Link href="/communities" className="transition hover:text-[#b94f22]">
                Communities
              </Link>
              <Link href="/discover" className="transition hover:text-[#b94f22]">
                Discover
              </Link>
              <Link href="/prayer" className="transition hover:text-[#b94f22]">
                Prayer
              </Link>
              <Link href="/groups" className="transition hover:text-[#b94f22]">
                Groups
              </Link>
              <Link href="/events" className="transition hover:text-[#b94f22]">
                Events
              </Link>
            </nav>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
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
