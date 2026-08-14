import Link from "next/link";
import type { Metadata } from "next";
import {
  deleteOpenCommunityPost,
  getOpenCommunityFeedForPublicPage,
  getRecentCommunityMembersForPublicPage,
} from "@/app/actions/community-posts";
import { getCommunityTopics } from "@/app/actions/community-topics";
import { getVisibleEvents } from "@/app/actions/events";
import { getDiscoverStudyGroupsForPublicPage } from "@/app/actions/groups";
import { getVisiblePrayerRequests } from "@/app/actions/prayer";
import { CommunityPostDisplay } from "@/components/community/community-post-display";
import { CommunityTabs } from "@/components/community/community-tabs";
import { TopicGrid } from "@/components/community/community-topic-components";
import { ActionButton, ContentCard, EmptyState, PageContainer, PageHeader, SectionHeader } from "@/components/ui/app-ui";

type CommunityPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Community",
  description: "Find a focused Selah Ember Community topic, or share uncategorized encouragement in General Community.",
};

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function Widget({ title, href, hrefLabel, children }: Readonly<{
  title: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}>) {
  return (
    <ContentCard as="section" className="bg-white/80 p-5">
      <SectionHeader
        title={title}
        action={href && hrefLabel ? (
          <Link href={href} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
            {hrefLabel}
          </Link>
        ) : null}
      />
      <div className="mt-4 space-y-3">{children}</div>
    </ContentCard>
  );
}

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const [data, topics, groupDiscovery, memberDiscovery, params] = await Promise.all([
    getOpenCommunityFeedForPublicPage(),
    getCommunityTopics(),
    getDiscoverStudyGroupsForPublicPage(),
    getRecentCommunityMembersForPublicPage(),
    searchParams,
  ]);
  const groups = groupDiscovery.groups;
  const members = memberDiscovery.members;
  const [prayers, events] = data.isSignedIn
    ? await Promise.all([getVisiblePrayerRequests(), getVisibleEvents()])
    : [[], []];
  const upcomingEvents = events.slice(0, 3);

  return (
    <PageContainer className="py-10">
      <PageHeader
        eyebrow="Community"
        title="Selah Ember Community"
        description="Choose the space that fits what you are facing, or use General Community for encouragement that does not belong to one topic."
        bordered
        action={data.isSignedIn ? (
          <ActionButton href="/community/new">Create general post</ActionButton>
        ) : (
          <ActionButton href="/signin">Sign in to post</ActionButton>
        )}
      />
      <CommunityTabs active="home" />

        {params.message ? (
          <div className="mt-6 rounded-xl border border-[#ead6c5] bg-white/80 p-4 text-sm text-[#67564c]">
            {params.message}
          </div>
        ) : null}

        <section aria-label="Community topics" className="mt-8">
          <SectionHeader
            title="Find a topic"
            description="Start with the issue you are dealing with. Topic spaces keep posts, testimonies, prayer, and Scripture focused."
            action={<ActionButton href="/community/topics" variant="secondary">View topics</ActionButton>}
          />
          <div className="mt-5">
            {topics.length === 0 ? (
              <EmptyState
                title="Topics are temporarily unavailable"
                description="General Community is still available below."
              />
            ) : (
              <TopicGrid topics={topics} />
            )}
          </div>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-label="General Community" className="space-y-5">
            <SectionHeader
              title="General Community"
              description="Uncategorized posts remain here. Topic posts stay inside their topic spaces."
              action={data.isSignedIn ? <ActionButton href="/community/new" variant="secondary">Create general post</ActionButton> : null}
            />
            {!data.community ? (
              <ContentCard as="div" className="bg-white/80">
                <h2 className="text-2xl font-semibold">
                  {data.isUnavailable ? "Community feed is temporarily unavailable" : "Community feed is not ready yet"}
                </h2>
                <p className="mt-3 leading-7 text-[#67564c]">
                  {data.isUnavailable
                    ? "Please try again later. Posts will return when the service is available."
                    : "Platform setup may still be in progress."}
                </p>
              </ContentCard>
            ) : null}

            {data.posts.length === 0 ? (
              <EmptyState
                title="No General Community posts yet"
                description="Topic posts are kept in their own spaces. Share here only when the post is not tied to one topic."
                action={data.isSignedIn ? <ActionButton href="/community/new">Create general post</ActionButton> : <ActionButton href="/signin">Sign in to post</ActionButton>}
              />
            ) : (
              data.posts.map((post) => (
                <div key={post.id} className="space-y-3">
                  <CommunityPostDisplay
                    post={post}
                    href={`/community/posts/${post.id}`}
                    editHref={post.can_edit ? `/community/posts/${post.id}/edit` : null}
                  />
                  {post.can_delete ? (
                    <form action={deleteOpenCommunityPost}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <input type="hidden" name="return_to" value="/community" />
                      <button type="submit" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
                        Delete post
                      </button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </section>

          <aside aria-label="Community overview" className="space-y-5">
            <Widget title="Recent prayer" href="/prayer" hrefLabel="View">
              {prayers.slice(0, 3).map((prayer) => (
                <p key={prayer.id} className="line-clamp-2 text-sm leading-6 text-[#67564c]">{prayer.title}</p>
              ))}
              {prayers.length === 0 ? <p className="text-sm text-[#67564c]">No public prayer requests yet.</p> : null}
            </Widget>

            <Widget title="Groups" href="/discover/groups" hrefLabel="Discover">
              {groups.slice(0, 4).map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`} className="block text-sm font-medium leading-6 text-[#67564c] hover:text-[#8a3f1e]">
                  <span className="line-clamp-2">{group.title}</span>
                  <span className="text-xs text-[#715e54]">{group.member_count} {group.member_count === 1 ? "member" : "members"}</span>
                </Link>
              ))}
              {groups.length === 0 ? (
                <p className="text-sm text-[#67564c]">
                  {groupDiscovery.isUnavailable ? "Groups are temporarily unavailable." : "No public groups yet."}
                </p>
              ) : null}
            </Widget>

            <Widget title="Upcoming events" href="/events" hrefLabel="View">
              {upcomingEvents.map((event) => (
                <Link key={event.id} href={`/events/${event.id}`} className="block text-sm leading-6 text-[#67564c] hover:text-[#8a3f1e]">
                  <span className="font-medium">{event.title}</span>
                  <span className="block text-xs">{formatDate(event.event_time)}</span>
                </Link>
              ))}
              {upcomingEvents.length === 0 ? <p className="text-sm text-[#67564c]">No upcoming events yet.</p> : null}
            </Widget>

            <Widget title="New members">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#ffe2cb] text-xs font-semibold text-[#8a3f1e]">
                    {member.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      member.display_name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#3b312b]">{member.display_name}</p>
                    <p className="text-xs text-[#715e54]">Joined {formatDate(member.created_at)}</p>
                  </div>
                </div>
              ))}
              {members.length === 0 ? (
                <p className="text-sm text-[#67564c]">
                  {memberDiscovery.isUnavailable ? "Members are temporarily unavailable." : "No members yet."}
                </p>
              ) : null}
            </Widget>
          </aside>
        </div>
    </PageContainer>
  );
}
