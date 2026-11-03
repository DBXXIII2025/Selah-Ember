import type { Metadata } from "next";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { browseCommunityPosts } from "@/app/actions/community-posts";
import { getCommunityTopics } from "@/app/actions/community-topics";
import { CommunityPostDisplay } from "@/components/community/community-post-display";
import { CommunityTabs } from "@/components/community/community-tabs";
import { ActionButton, EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";

export const metadata: Metadata = {
  title: "Browse Community",
  description: "Search and filter public Selah Ember Community posts.",
};
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; member?: string; topic?: string; sort?: string; page?: string; message?: string }>;
};

function url(params: Awaited<Props["searchParams"]>, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, page: String(page) })) {
    if (value) query.set(key, value);
  }
  return `/community/browse?${query}`;
}

export default async function CommunityBrowsePage({ searchParams }: Props) {
  const params = await searchParams;
  const [postsResult, topicsResult] = await Promise.allSettled([
    browseCommunityPosts({ ...params, page: Number(params.page) || 1 }),
    getCommunityTopics(),
  ]);
  const isUnavailable = postsResult.status === "rejected";
  const data = postsResult.status === "fulfilled"
    ? postsResult.value
    : { posts: [], total: 0, page: 1, pageCount: 1, migrationRequired: false };
  const topics = topicsResult.status === "fulfilled" ? topicsResult.value : [];
  const currentPath = url(params, data.page);

  return (
    <PageContainer className="py-6 sm:py-8">
      <PageHeader
        eyebrow="Community"
        title="Browse Community posts"
        description="Explore real conversations, find encouragement, and take part in a topic that matters to you."
        bordered
        action={<ActionButton href="/community/new">Start a discussion</ActionButton>}
      />
      <CommunityTabs active="browse" />

      <div className="mx-auto mt-6 grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section aria-label="Browse discussions" className="min-w-0">
          <form role="search" className="rounded-2xl border border-[#ead6c5] bg-white/85 p-4 sm:p-5">
            <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,0.7fr)_auto]">
              <label className="block min-w-0 text-xs font-semibold text-[#67564c]">
                Search discussions
                <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#d9b99d] bg-white px-3">
                  <Search aria-hidden="true" className="h-4 w-4 text-[#967867]" />
                  <input name="q" defaultValue={params.q || ""} placeholder="Search posts..." className="min-h-11 min-w-0 w-full text-sm font-normal text-[#211814] outline-none placeholder:text-[#9a8172]" />
                </span>
              </label>
              <label className="block min-w-0 text-xs font-semibold text-[#67564c]">
                Discussion topic
                <select name="topic" defaultValue={params.topic || ""} className="mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-[#d9b99d] bg-white px-3 text-sm font-normal text-[#211814]">
                  <option value="">All topics</option>
                  <option value="general">General Community</option>
                  {topics.map((topic) => <option key={topic.id} value={topic.slug}>{topic.name}</option>)}
                </select>
              </label>
              <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#a94720] px-5 text-sm font-semibold text-white transition hover:bg-[#8d3818]">Search</button>
            </div>
            <details className="mt-4 border-t border-[#ead6c5] pt-3">
              <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#8a3f1e]">
                <SlidersHorizontal aria-hidden="true" className="h-4 w-4" /> More filters
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[#67564c]">Member
                  <input name="member" defaultValue={params.member || ""} placeholder="Member name" className="mt-1.5 min-h-11 w-full rounded-xl border border-[#d9b99d] bg-white px-3 text-sm font-normal text-[#211814]" />
                </label>
                <label className="text-xs font-semibold text-[#67564c]">Sort by
                  <select name="sort" defaultValue={params.sort || "updated"} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#d9b99d] bg-white px-3 text-sm font-normal text-[#211814]">
                    <option value="updated">Recently updated</option>
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </label>
              </div>
            </details>
          </form>

          {params.message ? <p role="status" className="mt-4 rounded-xl border border-[#ead6c5] bg-white/80 p-3 text-sm text-[#67564c]">{params.message}</p> : null}
          {isUnavailable ? <p role="status" className="mt-4 rounded-xl border border-[#d9b99d] bg-[#fff4e8] p-4 text-sm text-[#8a3f1e]">Community posts are temporarily unavailable. Please try again shortly.</p> : null}
          {data.migrationRequired ? <p className="mt-4 rounded-xl bg-[#fff4e8] p-4 text-sm text-[#8a3f1e]">Migration 0047 is required to display pinned posts. Browsing remains available.</p> : null}

          {!isUnavailable ? (
            <>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#211814]">Discussions <span className="ml-1 text-sm font-normal text-[#67564c]">({data.total})</span></h2>
                <Link href="/community/browse" className="text-sm font-semibold text-[#8a3f1e] hover:underline">Clear filters</Link>
              </div>
              <div className="mt-3 space-y-3">
                {data.posts.length ? data.posts.map((post) => (
                  <CommunityPostDisplay key={post.id} post={post} compact href={`/community/posts/${post.id}`}
                    editHref={post.can_edit ? `/community/posts/${post.id}/edit` : null} pinReturnTo={currentPath} />
                )) : <EmptyState title="No discussions found" description="Try another topic or broaden your search." />}
              </div>
              <nav aria-label="Community results pages" className="mt-6 grid grid-cols-3 items-center rounded-xl border border-[#ead6c5] bg-white/75 p-4 text-sm">
                <div>{data.page > 1 ? <Link href={url(params, data.page - 1)} className="font-semibold text-[#8a3f1e]">Previous</Link> : null}</div>
                <p className="text-center text-xs font-semibold text-[#67564c]">Page {data.page} of {data.pageCount}</p>
                <div className="text-right">{data.page < data.pageCount ? <Link href={url(params, data.page + 1)} className="font-semibold text-[#8a3f1e]">Next</Link> : null}</div>
              </nav>
            </>
          ) : null}
        </section>

        <aside aria-label="Discussion navigation" className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-[#ead6c5] bg-white/75 p-5">
            <h2 className="text-sm font-bold text-[#211814]">Your community</h2>
            <p className="mt-2 text-sm leading-6 text-[#67564c]">Share a thought, ask a question, or encourage someone.</p>
            <div className="mt-4 grid gap-2">
              <Link href="/community/new" className="rounded-lg bg-[#a94720] px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#8d3818]">New post</Link>
              <Link href="/community/testimonies" className="rounded-lg border border-[#d9b99d] bg-white px-3 py-2.5 text-center text-sm font-semibold text-[#8a3f1e]">Testimonies</Link>
              <Link href="/members" className="rounded-lg border border-[#d9b99d] bg-white px-3 py-2.5 text-center text-sm font-semibold text-[#8a3f1e]">Find members</Link>
            </div>
          </div>
          <p className="px-2 text-xs leading-5 text-[#67564c]">Be thoughtful, kind, and respectful when sharing in the community.</p>
        </aside>
      </div>
    </PageContainer>
  );
}
