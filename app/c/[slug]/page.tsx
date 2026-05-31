import { MapPin, MessageSquareText, LibraryBig, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import {
  getCommunityMembershipStatus,
  getPublicCommunityBySlug,
} from "@/app/actions/communities";
import { CommunityMembershipForm } from "@/components/church/community-membership-form";
import { BrandMark } from "@/components/ui/brand-mark";

type PublicCommunityPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    message?: string;
  }>;
};

function formatMemberCount(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

export default async function PublicCommunityPage({
  params,
  searchParams,
}: PublicCommunityPageProps) {
  const { slug } = await params;
  const { message } = await searchParams;
  const community = await getPublicCommunityBySlug(slug);

  if (!community) {
    notFound();
  }

  const status = await getCommunityMembershipStatus(community.id);

  return (
    <main className="min-h-screen bg-[#f7ead7] text-[#211814]">
      <section className="relative isolate overflow-hidden px-6 py-10 sm:px-10 lg:px-16">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,#f7ead7_0%,#ead0ac_50%,#151210_100%)]" />
        <nav className="mx-auto flex max-w-7xl items-center justify-between">
          <BrandMark />
          <div className="flex items-center gap-4 text-sm font-semibold">
            <Link href="/discover" className="text-[#67564c] hover:text-[#b94f22]">
              Discover
            </Link>
            {status.isSignedIn ? (
              <form action={signOut}>
                <button type="submit" className="text-[#8a3f1e] hover:text-[#b94f22]">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/signin" className="text-[#8a3f1e] hover:text-[#b94f22]">
                Sign in
              </Link>
            )}
          </div>
        </nav>

        <div className="mx-auto mt-14 grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8a3f1e]">
              Community
            </p>
            <h1 className="mt-4 text-5xl font-semibold sm:text-6xl">{community.name}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#594a42]">
              {community.description || "A Selah Ember fellowship space for prayer, gathering, and shared spiritual life."}
            </p>
            {community.location ? (
              <p className="mt-6 flex items-center gap-2 font-medium text-[#594a42]">
                <MapPin aria-hidden="true" className="h-5 w-5 text-[#b94f22]" />
                {community.location}
              </p>
            ) : null}
            <p className="mt-4 flex items-center gap-2 font-medium text-[#594a42]">
              <UsersRound aria-hidden="true" className="h-5 w-5 text-[#b94f22]" />
              {formatMemberCount(community.member_count)}
            </p>
            {message ? (
              <p className="mt-6 max-w-xl rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
                {message}
              </p>
            ) : null}
            <div className="mt-8">
              <CommunityMembershipForm community={community} status={status} />
            </div>
            <div className="mt-6 rounded-2xl border border-white/55 bg-white/65 p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3f1e]">
                <MessageSquareText aria-hidden="true" className="h-4 w-4" />
                Discussions
              </p>
              <p className="mt-2 text-sm leading-6 text-[#594a42]">
                Member-only threads for fellowship, questions, and shared resources.
              </p>
              {status.isMember ? (
                <Link
                  href={`/communities/${community.id}/discussions`}
                  className="mt-4 inline-flex rounded-full bg-[#cf5f2b] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
                >
                  Open discussions
                </Link>
              ) : (
                <p className="mt-4 text-sm font-semibold text-[#8a3f1e]">
                  {status.isSignedIn ? "Join this community to view discussions." : "Sign in and join to view discussions."}
                </p>
              )}
            </div>
            <div className="mt-4 rounded-2xl border border-white/55 bg-white/65 p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3f1e]">
                <LibraryBig aria-hidden="true" className="h-4 w-4" />
                Media Library
              </p>
              <p className="mt-2 text-sm leading-6 text-[#594a42]">
                Published sermons, teachings, testimonies, and resource links.
              </p>
              <Link
                href={`/c/${community.slug}/media`}
                className="mt-4 inline-flex rounded-full bg-[#cf5f2b] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
              >
                Open media library
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/45 bg-[#211b17]/90 shadow-2xl shadow-[#3b2117]/30">
            <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,#f4dcc0,#cf5f2b,#2a211d)]">
              {community.banner_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={community.banner_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <UsersRound aria-hidden="true" className="h-16 w-16 text-[#fff8ed]" />
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
