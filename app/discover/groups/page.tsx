import { BookOpen, CalendarDays, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";
import { getDiscoverStudyGroups } from "@/app/actions/groups";

export const dynamic = "force-dynamic";

function formatMemberCount(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

export default async function DiscoverGroupsPage() {
  const groups = await getDiscoverStudyGroups();

  return (
    <main className="min-h-screen bg-[#fff8ed] text-[#211b17]">
      <header className="border-b border-[#ead6c5] bg-white/75">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10 lg:px-16">
          <Link href="/" className="text-lg font-semibold">
            Selah Ember
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-[#67564c]">
            <Link href="/discover" className="transition hover:text-[#b94f22]">
              Discover
            </Link>
            <Link href="/discover/groups" className="text-[#b94f22]">
              Groups
            </Link>
            <Link href="/signin" className="transition hover:text-[#b94f22]">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
              Group discovery
            </p>
            <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
              Find a Bible study group
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
              Browse public study groups and join a Scripture-centered rhythm of prayer, learning, and fellowship.
            </p>
          </div>

          {groups.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
                <BookOpen aria-hidden="true" className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold">No public groups yet</h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
                Public study groups will appear here as leaders create them.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <article
                  key={group.id}
                  className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm"
                >
                  <h2 className="text-2xl font-semibold">{group.title}</h2>
                  <p className="mt-4 line-clamp-3 leading-7 text-[#67564c]">
                    {group.description || "A study group foundation ready for Scripture and fellowship."}
                  </p>
                  <div className="mt-5 space-y-2 text-sm text-[#67564c]">
                    <p className="flex items-center gap-2">
                      <UsersRound aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                      {formatMemberCount(group.member_count)}
                    </p>
                    {group.meeting_time ? (
                      <p className="flex items-center gap-2">
                        <CalendarDays aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                        {group.meeting_time}
                      </p>
                    ) : null}
                    {group.location ? (
                      <p className="flex items-center gap-2">
                        <MapPin aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                        {group.location}
                      </p>
                    ) : null}
                    {group.community_name ? (
                      <p className="rounded-full bg-[#ffe2cb] px-3 py-1 font-medium text-[#8a3f1e]">
                        {group.community_name}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/groups/${group.id}`}
                    className="mt-6 inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
                  >
                    View group
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
