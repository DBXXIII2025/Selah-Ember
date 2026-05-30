import { CalendarDays, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMembershipStatus, getStudyGroupById } from "@/app/actions/groups";
import { GroupMembershipForm } from "@/components/groups/group-membership-form";

type GroupDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    message?: string;
  }>;
};

function formatMemberCount(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

export default async function GroupDetailPage({ params, searchParams }: GroupDetailPageProps) {
  const { id } = await params;
  const { message } = await searchParams;
  const group = await getStudyGroupById(id);

  if (!group) {
    notFound();
  }

  const status = await getMembershipStatus(group.id);

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Link
          href={status.isSignedIn ? "/groups" : "/discover/groups"}
          className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]"
        >
          Back to groups
        </Link>

        <article className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
            Study group
          </p>
          <h1 className="mt-3 text-4xl font-semibold">{group.title}</h1>
          {status.isOwner ? (
            <p className="mt-4 inline-flex rounded-full bg-[#fff4e8] px-4 py-2 text-sm font-semibold text-[#8a3f1e]">
              Group owner
            </p>
          ) : null}
          <p className="mt-4 max-w-3xl whitespace-pre-line leading-7 text-[#67564c]">
            {group.description || "A quiet group foundation ready for Scripture and fellowship."}
          </p>
          {message ? (
            <p className="mt-6 max-w-xl rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
              {message}
            </p>
          ) : null}
          <div className="mt-8">
            <GroupMembershipForm group={group} status={status} />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#fff4e8] p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3f1e]">
                <UsersRound aria-hidden="true" className="h-4 w-4" />
                Members
              </p>
              <p className="mt-2 text-lg font-semibold">{formatMemberCount(group.member_count)}</p>
            </div>
            {status.role ? (
              <div className="rounded-2xl bg-[#fff4e8] p-5">
                <p className="text-sm font-semibold text-[#8a3f1e]">Your role</p>
                <p className="mt-2 text-lg font-semibold">{status.role}</p>
              </div>
            ) : null}
            {!status.isSignedIn ? (
              <div className="rounded-2xl bg-[#fff4e8] p-5">
                <p className="text-sm font-semibold text-[#8a3f1e]">Membership</p>
                <p className="mt-2 text-lg font-semibold">Sign in to join</p>
              </div>
            ) : null}
            {status.isSignedIn && !status.role ? (
              <div className="rounded-2xl bg-[#fff4e8] p-5">
                <p className="text-sm font-semibold text-[#8a3f1e]">Membership</p>
                <p className="mt-2 text-lg font-semibold">Open to join</p>
              </div>
            ) : null}
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
