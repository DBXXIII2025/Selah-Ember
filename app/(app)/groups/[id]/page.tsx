import { CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudyGroupById } from "@/app/actions/groups";

type GroupDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { id } = await params;
  const group = await getStudyGroupById(id);

  if (!group) {
    notFound();
  }

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Link href="/groups" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to groups
        </Link>

        <article className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
            Study group
          </p>
          <h1 className="mt-3 text-4xl font-semibold">{group.title}</h1>
          <p className="mt-4 max-w-3xl whitespace-pre-line leading-7 text-[#67564c]">
            {group.description || "A quiet group foundation ready for Scripture and fellowship."}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#fff4e8] p-5">
              <p className="text-sm font-semibold text-[#8a3f1e]">Role</p>
              <p className="mt-2 text-lg font-semibold">{group.role || "member"}</p>
            </div>
            {group.community_name ? (
              <div className="rounded-2xl bg-[#fff4e8] p-5">
                <p className="text-sm font-semibold text-[#8a3f1e]">Community</p>
                <p className="mt-2 text-lg font-semibold">{group.community_name}</p>
              </div>
            ) : null}
            {group.meeting_time ? (
              <div className="rounded-2xl bg-[#fff4e8] p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3f1e]">
                  <CalendarDays aria-hidden="true" className="h-4 w-4" />
                  Meeting time
                </p>
                <p className="mt-2 text-lg font-semibold">{group.meeting_time}</p>
              </div>
            ) : null}
            {group.location ? (
              <div className="rounded-2xl bg-[#fff4e8] p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3f1e]">
                  <MapPin aria-hidden="true" className="h-4 w-4" />
                  Location
                </p>
                <p className="mt-2 text-lg font-semibold">{group.location}</p>
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
