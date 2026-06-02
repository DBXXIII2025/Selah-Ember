import Link from "next/link";
import { deleteOpenCommunityPost, getOpenCommunityFeed } from "@/app/actions/community-posts";
import { getVisibleEvents } from "@/app/actions/events";
import { getDiscoverStudyGroups } from "@/app/actions/groups";
import { getVisiblePrayerRequests } from "@/app/actions/prayer";
import { CommunityPostDisplay } from "@/components/community/community-post-display";

type CommunityPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const [data, groups, params] = await Promise.all([getOpenCommunityFeed(), getDiscoverStudyGroups(), searchParams]);
  const [prayers, events] = data.isSignedIn
    ? await Promise.all([getVisiblePrayerRequests(), getVisibleEvents()])
    : [[], []];
  const upcomingEvents = events.slice(0, 3);

  return (
    <section className="px-6 py-10 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">Community</p>
            <h1 className="mt-3 text-4xl font-semibold">Selah Ember Community</h1>
            <p className="mt-3 max-w-2xl leading-7 text-[#67564c]">
              Share encouragement, prayer needs, updates, images, videos, and links with the whole community.
            </p>
          </div>
          {data.isSignedIn ? (
            <Link href="/community/new" className="inline-flex justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
              New post
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

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <aside className="rounded-2xl border border-[#ead6c5] bg-white/75 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Prayer</h2>
              <Link href="/prayer" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
                View
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {prayers.slice(0, 3).map((prayer) => (
                <p key={prayer.id} className="line-clamp-2 text-sm leading-6 text-[#67564c]">{prayer.title}</p>
              ))}
              {prayers.length === 0 ? <p className="text-sm text-[#67564c]">No public prayer requests yet.</p> : null}
            </div>
          </aside>

          <aside className="rounded-2xl border border-[#ead6c5] bg-white/75 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Groups</h2>
              <Link href="/discover/groups" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
                Discover
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {groups.slice(0, 3).map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`} className="block line-clamp-2 text-sm font-medium leading-6 text-[#67564c] hover:text-[#8a3f1e]">
                  {group.title}
                </Link>
              ))}
              {groups.length === 0 ? <p className="text-sm text-[#67564c]">No public groups yet.</p> : null}
            </div>
          </aside>

          <aside className="rounded-2xl border border-[#ead6c5] bg-white/75 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Events</h2>
              <Link href="/events" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
                View
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {upcomingEvents.map((event) => (
                <Link key={event.id} href={`/events/${event.id}`} className="block text-sm leading-6 text-[#67564c] hover:text-[#8a3f1e]">
                  <span className="font-medium">{event.title}</span>
                  <span className="block text-xs">{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(event.event_time))}</span>
                </Link>
              ))}
              {upcomingEvents.length === 0 ? <p className="text-sm text-[#67564c]">No upcoming events yet.</p> : null}
            </div>
          </aside>
        </div>

        {!data.community ? (
          <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Community feed is not ready yet</h2>
            <p className="mt-3 leading-7 text-[#67564c]">The default community migration needs to be applied.</p>
          </div>
        ) : null}

        <div className="mt-8 space-y-5">
          {data.posts.length === 0 ? (
            <div className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">No posts yet</h2>
              <p className="mt-3 leading-7 text-[#67564c]">Start the community feed with a prayer, update, or encouragement.</p>
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
        </div>
      </div>
    </section>
  );
}
