import type { Metadata } from "next";
import Link from "next/link";
import { browseCommunityPosts } from "@/app/actions/community-posts";
import { getCommunityTopics } from "@/app/actions/community-topics";
import { CommunityPostDisplay } from "@/components/community/community-post-display";
import { CommunityTabs } from "@/components/community/community-tabs";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";

export const metadata: Metadata = { title: "Browse Community", description: "Search and filter public Selah Ember Community posts." };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; member?: string; topic?: string; sort?: string; page?: string }> };

function url(params: Awaited<Props["searchParams"]>, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, page: String(page) })) if (value) query.set(key, value);
  return `/community/browse?${query}`;
}

export default async function CommunityBrowsePage({ searchParams }: Props) {
  const params = await searchParams;
  const [data, topics] = await Promise.all([browseCommunityPosts({ ...params, page: Number(params.page) || 1 }), getCommunityTopics()]);
  return <PageContainer className="py-10">
    <PageHeader eyebrow="Community" title="Browse Community posts" description="Find encouragement by keyword, member, or topic." bordered />
    <CommunityTabs active="browse" />
    <form className="mt-8 grid gap-3 rounded-2xl border border-[#ead6c5] bg-white/80 p-5 md:grid-cols-4" role="search">
      <label className="text-sm font-semibold">Keywords<input name="q" defaultValue={params.q} className="mt-2 w-full rounded-xl border border-[#d9b99d] px-3 py-2" /></label>
      <label className="text-sm font-semibold">Member<input name="member" defaultValue={params.member} className="mt-2 w-full rounded-xl border border-[#d9b99d] px-3 py-2" /></label>
      <label className="text-sm font-semibold">Topic<select name="topic" defaultValue={params.topic || ""} className="mt-2 w-full rounded-xl border border-[#d9b99d] px-3 py-2"><option value="">All topics</option>{topics.map((topic) => <option key={topic.id} value={topic.slug}>{topic.name}</option>)}</select></label>
      <label className="text-sm font-semibold">Sort<select name="sort" defaultValue={params.sort || "updated"} className="mt-2 w-full rounded-xl border border-[#d9b99d] px-3 py-2"><option value="updated">Recently updated</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label>
      <button className="rounded-full bg-[#a94720] px-5 py-2 font-semibold text-white md:col-span-4 md:justify-self-start">Apply filters</button>
    </form>
    {data.migrationRequired ? <p className="mt-4 rounded-xl bg-[#fff4e8] p-4 text-sm text-[#8a3f1e]">Migration 0047 is required to display pinned posts. Browsing remains available.</p> : null}
    <p className="mt-6 text-sm text-[#67564c]">{data.total} {data.total === 1 ? "post" : "posts"}</p>
    <div className="mt-4 space-y-5">{data.posts.length ? data.posts.map((post) => <CommunityPostDisplay key={post.id} post={post} href={`/community/posts/${post.id}`} editHref={post.can_edit ? `/community/posts/${post.id}/edit` : null} />) : <EmptyState title="No posts found" description="Try broadening your filters." />}</div>
    <nav aria-label="Community results pages" className="mt-8 flex justify-between">{data.page > 1 ? <Link href={url(params, data.page - 1)} className="font-semibold text-[#8a3f1e]">Previous</Link> : <span />}{data.page < data.pageCount ? <Link href={url(params, data.page + 1)} className="font-semibold text-[#8a3f1e]">Next</Link> : null}</nav>
  </PageContainer>;
}
