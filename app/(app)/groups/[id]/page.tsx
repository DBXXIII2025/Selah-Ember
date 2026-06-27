import { CalendarDays, MapPin, MessageSquareText, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { getMembershipStatus, getStudyGroupById } from "@/app/actions/groups";
import { GroupMembershipForm } from "@/components/groups/group-membership-form";
import { ActionButton, Badge, DetailHeader, DetailHero, FormNotice, PageContainer } from "@/components/ui/app-ui";

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
    <PageContainer>
      <div className="mx-auto max-w-5xl">
        <DetailHeader
          backHref={status.isSignedIn ? "/groups" : "/discover/groups"}
          backLabel="Back to groups"
          eyebrow="Study group"
          title={group.title}
          description={<p className="whitespace-pre-line">{group.description || "A quiet group foundation ready for Scripture and fellowship."}</p>}
        >
          <div className="flex flex-wrap gap-3">
            {status.isOwner ? <Badge>Group owner</Badge> : null}
          </div>
          {message ? <FormNotice className="mt-4 max-w-xl">{message}</FormNotice> : null}
        </DetailHeader>

        <DetailHero className="mt-8">
          <div>
            <GroupMembershipForm group={group} status={status} />
          </div>

          <div className="mt-8 rounded-2xl bg-[#fff4e8] p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3f1e]">
              <MessageSquareText aria-hidden="true" className="h-4 w-4" />
              Discussions
            </p>
            <p className="mt-2 text-sm leading-6 text-[#67564c]">
              Group-only threads for study notes, questions, and fellowship.
            </p>
            {status.isMember ? (
              <ActionButton href={`/groups/${group.id}/discussions`} size="sm" className="mt-4">Open discussions</ActionButton>
            ) : (
              <p className="mt-4 text-sm font-semibold text-[#8a3f1e]">
                {status.isSignedIn ? "Join this group to view discussions." : "Sign in and join to view discussions."}
              </p>
            )}
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
        </DetailHero>
      </div>
    </PageContainer>
  );
}
