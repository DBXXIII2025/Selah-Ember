import Link from "next/link";
import { deleteOpenCommunityPost, getOpenCommunityFeed, getRecentCommunityMembers } from "@/app/actions/community-posts";
import { getVisibleEvents } from "@/app/actions/events";
import { getDiscoverStudyGroups } from "@/app/actions/groups";
import { getVisiblePrayerRequests } from "@/app/actions/prayer";
import { CommunityPostDisplay } from "@/components/community/community-post-display";

type CommunityPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

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
    <section className="rounded-2xl border border-[#ead6c5] bg-white/80 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {href && hrefLabel ? (
          <Link href={href} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
            {hrefLabel}
          </Link>
        ) : null}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const [data, groups, members, params] = await Promise.all([
    getOpenCommunityFeed(),
    getDiscoverStudyGroups(),
    getRecentCommunityMembers(),
    searchParams,
  ]);
  const [prayers, events] = data.isSignedIn
    ? await Promise.all([getVisiblePrayerRequests(), getVisibleEvents()])
    : [[], []];
  const upcomingEvents = events.slice(0, 3);

  return (
    <section className="px-6 py-10 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 border-b border-[#d9b99d] pb-8 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">Community</p>
            <h1 className="mt-3 text-4xl font-semibold">Selah Ember Community</h1>
            <p className="mt-3 max-w-2xl leading-7 text-[#67564c]">
              A shared faith feed for encouragement, prayer follow-up, group discovery, events, safe links, images, and video.
            </p>
          </div>
          {data.isSignedIn ? (
            <Link href="/community/new" className="inline-flex justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
              Create post
            </Link>
          ) : (
            <Link href="/signin" className="inline-flex justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
              Sign in to post
            </Link>
          )}
        </div>

        {params.message ? (
          <div className="mt-6 rounded-xl border border-[#ead6c5] bg-white/80 p-4 text-sm text-[#67564c]">
            {params.message}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <main className="space-y-5">
            {!data.community ? (
              <div className="rounded-2xl border border-[#ead6c5] bg-white/80 p-6 shadow-sm">
                <h2 className="text-2xl font-semibold">Community feed is not ready yet</h2>
                <p className="mt-3 leading-7 text-[#67564c]">The default community migration needs to be applied.</p>
              </div>
            ) : null}

            {data.posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d9b99d] bg-white/70 p-8 shadow-sm">
                <h2 className="text-2xl font-semibold">Start the first conversation</h2>
                <p className="mt-3 max-w-xl leading-7 text-[#67564c]">
                  Share an encouragement, testimony, question, prayer follow-up, image, video, or safe link with the community.
                </p>
                {data.isSignedIn ? (
                  <Link href="/community/new" className="mt-5 inline-flex rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
                    Create post
                  </Link>
                ) : (
                  <Link href="/signin" className="mt-5 inline-flex rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
                    Sign in to post
                  </Link>
                )}
              </div>
            ) : (
              data.posts.map((post) => (
                <div key={post.id} className="space-y-3">
                  <CommunityPostDisplay post={post} href={`/community/posts/${post.id}`} />
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
          </main>

          <aside className="space-y-5">
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
                  <span className="text-xs text-[#8a7467]">{group.member_count} {group.member_count === 1 ? "member" : "members"}</span>
                </Link>
              ))}
              {groups.length === 0 ? <p className="text-sm text-[#67564c]">No public groups yet.</p> : null}
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
                    <p className="text-xs text-[#8a7467]">Joined {formatDate(member.created_at)}</p>
                  </div>
                </div>
              ))}
              {members.length === 0 ? <p className="text-sm text-[#67564c]">No members yet.</p> : null}
            </Widget>
          </aside>
        </div>
      </div>
    </section>
  );
}
