import { BookOpen, CalendarDays, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";
import { getDiscoverStudyGroups } from "@/app/actions/groups";
import { ActionButton, Badge, ContentCard, EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";
import { BrandMark } from "@/components/ui/brand-mark";

export const dynamic = "force-dynamic";

function formatMemberCount(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

export default async function DiscoverGroupsPage() {
  const groups = await getDiscoverStudyGroups();

  return (
    <main className="min-h-screen bg-[#f7ead7] text-[#211814]">
      <header className="border-b border-[#c8874d]/30 bg-[#151210]/95 text-[#fff4df]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10 lg:px-16">
          <BrandMark variant="light" />
          <nav className="flex items-center gap-4 text-sm font-semibold text-[#d8bea3]">
            <Link href="/discover" className="transition hover:text-[#f0a35c]">
              Discover
            </Link>
            <Link href="/discover/groups" className="text-[#f0a35c]">
              Groups
            </Link>
            <Link href="/signin" className="transition hover:text-[#f0a35c]">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <PageContainer>
        <PageHeader
          eyebrow="Group discovery"
          title="Find a Bible study group"
          description="Browse public study groups and join a Scripture-centered rhythm of prayer, learning, and fellowship."
        />

        {groups.length === 0 ? (
          <EmptyState className="mt-10" icon={BookOpen} title="No public groups yet" description="Public study groups will appear here as members create them." />
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <ContentCard key={group.id}>
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
                      <Badge className="w-fit">{group.community_name}</Badge>
                    ) : null}
                  </div>
                  <ActionButton href={`/groups/${group.id}`} variant="secondary" size="sm" className="mt-6">View group</ActionButton>
                </ContentCard>
              ))}
            </div>
          )}
      </PageContainer>
    </main>
  );
}
