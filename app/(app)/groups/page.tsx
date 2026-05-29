import { BookOpen, CalendarDays, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { getCurrentUserStudyGroups } from "@/app/actions/groups";

export default async function GroupsPage() {
  const groups = await getCurrentUserStudyGroups();

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
              Bible study groups
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Your study groups</h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
              Gather people around Scripture, prayer, and steady fellowship rhythms.
            </p>
          </div>
          <Link
            href="/groups/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            New group
          </Link>
        </div>

        {groups.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
              <BookOpen aria-hidden="true" className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold">No study groups yet</h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
              Create a simple group for Bible study, discipleship, or a fellowship circle.
            </p>
            <Link
              href="/groups/new"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b94f22]"
            >
              Create group
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <article key={group.id} className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">{group.title}</h2>
                    {group.role ? <p className="mt-1 text-sm font-medium text-[#b94f22]">{group.role}</p> : null}
                  </div>
                </div>
                <p className="mt-4 line-clamp-3 leading-7 text-[#67564c]">
                  {group.description || "A study group foundation ready for Scripture and fellowship."}
                </p>
                <div className="mt-5 space-y-2 text-sm text-[#67564c]">
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
                  Open group
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
