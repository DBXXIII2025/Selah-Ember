import { CalendarDays, MapPin, MessageCircleHeart, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommunityManagementSummary } from "@/app/actions/leader";
import { CommunityEditForm } from "@/components/leader/community-edit-form";

type LeaderCommunityPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    message?: string;
  }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMemberCount(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

export default async function LeaderCommunityPage({
  params,
  searchParams,
}: LeaderCommunityPageProps) {
  const { id } = await params;
  const { message } = await searchParams;
  const summary = await getCommunityManagementSummary(id);

  if (!summary) {
    notFound();
  }

  const { community } = summary;

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <Link href="/leader" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to leader dashboard
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
              Community Management
            </p>
            <h1 className="mt-3 text-4xl font-semibold">{community.name}</h1>
            {!community.is_published ? (
              <p className="mt-4 inline-flex rounded-full bg-[#fff4e8] px-4 py-2 text-sm font-semibold text-[#8a3f1e]">
                Pending Verification - your community is saved as a draft.
              </p>
            ) : null}
            <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
              {community.description || "Keep this community's public details current."}
            </p>
            <div className="mt-5 space-y-2 text-sm text-[#67564c]">
              <p className="flex items-center gap-2">
                <UsersRound aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                {formatMemberCount(community.member_count)}
              </p>
              {community.location ? (
                <p className="flex items-center gap-2">
                  <MapPin aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                  {community.location}
                </p>
              ) : null}
            </div>
            <Link
              href={`/c/${community.slug}`}
              className="mt-6 inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
            >
              View public page
            </Link>
            <Link
              href={`/leader/communities/${community.id}/media`}
              className="mt-3 inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
            >
              Manage media
            </Link>
            <Link
              href={`/leader/communities/${community.id}/updates`}
              className="mt-3 inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
            >
              Manage updates
            </Link>
          </div>

          <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Public details</h2>
            {message ? (
              <p className="mt-5 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
                {message}
              </p>
            ) : null}
            <div className="mt-6">
              <CommunityEditForm community={community} />
            </div>
          </section>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Membership</h2>
            <div className="mt-5 space-y-3">
              {summary.members.length === 0 ? (
                <p className="text-[#67564c]">No membership rows found.</p>
              ) : (
                summary.members.map((member) => (
                  <div key={member.id} className="rounded-xl bg-[#fff4e8] px-4 py-3">
                    <p className="font-semibold">{member.display_name}</p>
                    <p className="mt-1 text-sm text-[#67564c]">
                      {member.role} · Joined {formatDate(member.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Recent prayer</h2>
            <div className="mt-5 space-y-3">
              {summary.prayer_requests.length === 0 ? (
                <p className="text-[#67564c]">No community prayer requests yet.</p>
              ) : (
                summary.prayer_requests.map((request) => (
                  <article key={request.id} className="rounded-xl bg-[#fff4e8] px-4 py-3">
                    <p className="flex items-center gap-2 font-semibold">
                      <MessageCircleHeart aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                      {request.title}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-[#67564c]">
                      {request.content || "No details shared."}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-[#8a3f1e]">
                      {request.is_private ? "Private" : "Community visible"} · {formatDate(request.created_at)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Study groups</h2>
            <div className="mt-5 space-y-3">
              {summary.study_groups.length === 0 ? (
                <p className="text-[#67564c]">No study groups attached yet.</p>
              ) : (
                summary.study_groups.map((group) => (
                  <article key={group.id} className="rounded-xl bg-[#fff4e8] px-4 py-3">
                    <Link href={`/groups/${group.id}`} className="font-semibold hover:text-[#b94f22]">
                      {group.title}
                    </Link>
                    <p className="mt-2 text-sm text-[#67564c]">
                      {formatMemberCount(group.member_count)}
                      {group.meeting_time ? ` · ${group.meeting_time}` : ""}
                      {group.location ? ` · ${group.location}` : ""}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Events</h2>
            <div className="mt-5 space-y-3">
              {summary.events.length === 0 ? (
                <p className="text-[#67564c]">No events attached yet.</p>
              ) : (
                summary.events.map((event) => (
                  <article key={event.id} className="rounded-xl bg-[#fff4e8] px-4 py-3">
                    <Link href={`/events/${event.id}`} className="font-semibold hover:text-[#b94f22]">
                      {event.title}
                    </Link>
                    <p className="mt-2 flex items-center gap-2 text-sm text-[#67564c]">
                      <CalendarDays aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                      {formatEventTime(event.event_time)}
                    </p>
                    <p className="mt-1 text-sm text-[#67564c]">
                      {event.going_count} going · {event.interested_count} interested
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
