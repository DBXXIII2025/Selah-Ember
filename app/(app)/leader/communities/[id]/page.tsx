import { CalendarDays, MapPin, MessageCircleHeart, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommunityManagementSummary } from "@/app/actions/leader";
import { CommunityEditForm } from "@/components/leader/community-edit-form";
import {
  ActionButton,
  Badge,
  ContentCard,
  DetailHeader,
  FormNotice,
  PageContainer,
  SectionHeader,
} from "@/components/ui/app-ui";

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
    <PageContainer>
        <DetailHeader
          backHref="/leader"
          backLabel="Back"
          eyebrow="Legacy community management"
          title={community.name}
          description={community.description || "Keep this existing community's public details current."}
        >
          {!community.is_published ? <Badge>Draft community</Badge> : null}
          <div className="mt-4 space-y-2 text-sm text-[#67564c]">
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
          <div className="mt-6 flex flex-wrap gap-3">
            <ActionButton href={`/c/${community.slug}`} variant="secondary" size="sm">View public page</ActionButton>
            <ActionButton href={`/leader/communities/${community.id}/media`} variant="secondary" size="sm">Manage media</ActionButton>
            <ActionButton href={`/leader/communities/${community.id}/updates`} variant="secondary" size="sm">Manage updates</ActionButton>
            <ActionButton href={`/leader/communities/${community.id}/giving`} variant="secondary" size="sm">Manage giving</ActionButton>
          </div>
        </DetailHeader>

          <ContentCard as="section" className="mt-8">
            <SectionHeader title="Public details" description="Update the existing public community page information." />
            {message ? (
              <FormNotice className="mt-5">{message}</FormNotice>
            ) : null}
            <div className="mt-6">
              <CommunityEditForm community={community} />
            </div>
          </ContentCard>

        <div className="mt-10 grid gap-6 xl:grid-cols-2">
          <ContentCard as="section">
            <SectionHeader title="Membership" />
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
          </ContentCard>

          <ContentCard as="section">
            <SectionHeader title="Recent prayer" />
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
          </ContentCard>

          <ContentCard as="section">
            <SectionHeader title="Study groups" />
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
          </ContentCard>

          <ContentCard as="section">
            <SectionHeader title="Events" />
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
          </ContentCard>
        </div>
    </PageContainer>
  );
}
