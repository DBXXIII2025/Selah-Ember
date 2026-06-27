import { BookOpen, CalendarDays, MapPin, Plus, UsersRound } from "lucide-react";
import { deleteOwnedGroup, getCurrentUserStudyGroups } from "@/app/actions/groups";
import { ActionButton, Badge, ConfirmActionPanel, ContentCard, EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";

function formatMemberCount(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

export default async function GroupsPage() {
  const groups = await getCurrentUserStudyGroups();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Bible study groups"
        title="Your study groups"
        description="Gather people around Scripture, prayer, and steady fellowship rhythms."
        action={<ActionButton href="/groups/new"><Plus aria-hidden="true" className="h-4 w-4" />New group</ActionButton>}
      />

      {groups.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={BookOpen}
          title="No study groups yet"
          description="Create a simple group for Bible study, discipleship, or a fellowship circle."
          action={<ActionButton href="/groups/new">Create group</ActionButton>}
        />
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <ContentCard key={group.id}>
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
                    <Badge className="w-fit">{group.community_name}</Badge>
                  ) : null}
                  <p className="flex items-center gap-2">
                    <UsersRound aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                    {formatMemberCount(group.member_count)}
                  </p>
                </div>
                <ActionButton href={`/groups/${group.id}`} variant="secondary" size="sm" className="mt-6">Open group</ActionButton>
                {group.role === "owner" || group.role === "leader" ? (
                  <ConfirmActionPanel
                    action={deleteOwnedGroup}
                    hiddenFields={{ group_id: group.id }}
                    title="Delete this group"
                    description="This removes the group and its membership space. This action cannot be undone."
                    actionLabel="Delete group"
                    confirmationId={`delete-group-${group.id}`}
                    className="mt-5"
                  />
                ) : null}
              </ContentCard>
            ))}
          </div>
        )}
    </PageContainer>
  );
}
