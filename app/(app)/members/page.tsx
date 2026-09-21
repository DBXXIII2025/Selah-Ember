import type { Metadata } from "next";
import Link from "next/link";
import { getMembers } from "@/app/actions/members";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";

/* eslint-disable @next/next/no-img-element -- Member avatars are user-provided remote URLs. */

export const metadata: Metadata = { title: "Members", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function MembersPage({ searchParams }: Props) {
  const params = await searchParams; const data = await getMembers(params.q, Number(params.page) || 1);
  const pageHref = (page: number) => `/members?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), page: String(page) })}`;
  return <PageContainer className="py-10"><PageHeader eyebrow="Community" title="Members" description="Meet people sharing encouragement, testimony, and study in Selah Ember." bordered />
    <form role="search" className="mt-8 flex gap-3"><label className="flex-1 text-sm font-semibold">Name or username<input name="q" defaultValue={params.q} className="mt-2 w-full rounded-xl border border-[#d9b99d] bg-white px-4 py-3" /></label><button className="mt-7 rounded-full bg-[#a94720] px-5 font-semibold text-white">Search</button></form>
    <p className="mt-6 text-sm text-[#67564c]">{data.total} {data.total === 1 ? "member" : "members"}</p>
    {data.members.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.members.map((member) => <Link key={member.id} href={`/members/${member.user_id}`} className="rounded-2xl border border-[#ead6c5] bg-white/80 p-5 hover:border-[#a94720]"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#ffe2cb] font-semibold text-[#8a3f1e]">{member.avatar_url ? <img src={member.avatar_url} alt="" className="h-full w-full object-cover" /> : member.display_name[0]?.toUpperCase()}</div><div><h2 className="font-semibold">{member.display_name}</h2>{member.username ? <p className="text-sm text-[#67564c]">@{member.username}</p> : null}</div></div></Link>)}</div> : <EmptyState className="mt-6" title="No members found" description="Try another name or username." />}
    <nav aria-label="Member directory pages" className="mt-8 flex justify-between">{data.page > 1 ? <Link className="font-semibold text-[#8a3f1e]" href={pageHref(data.page - 1)}>Previous</Link> : <span />}{data.page < data.pageCount ? <Link className="font-semibold text-[#8a3f1e]" href={pageHref(data.page + 1)}>Next</Link> : null}</nav>
  </PageContainer>;
}
