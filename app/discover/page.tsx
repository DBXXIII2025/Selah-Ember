import { MapPin, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { getDiscoverCommunities } from "@/app/actions/communities";
import { BrandMark } from "@/components/ui/brand-mark";
import { ActionButton, ContentCard, EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";

export const dynamic = "force-dynamic";

function formatMemberCount(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

export default async function DiscoverPage() {
  const communities = await getDiscoverCommunities();

  return (
    <main className="min-h-screen bg-[#f7ead7] text-[#211814]">
      <header className="border-b border-[#c8874d]/30 bg-[#151210]/95 text-[#fff4df]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10 lg:px-16">
          <BrandMark variant="light" />
          <nav className="flex items-center gap-4 text-sm font-semibold text-[#d8bea3]">
            <Link href="/discover" className="text-[#f0a35c]">
              Discover
            </Link>
            <Link href="/signin" className="transition hover:text-[#f0a35c]">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <PageContainer>
        <PageHeader
          eyebrow="Discover"
          title="Find a fellowship community"
          description="Browse public Selah Ember spaces where prayer, study, and gathering are taking shape."
        />

        {communities.length === 0 ? (
          <EmptyState className="mt-10" icon={Search} title="No public communities yet" description="New fellowship spaces will appear here as communities are created." />
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {communities.map((community) => (
                <ContentCard key={community.id} className="overflow-hidden p-0">
                  <div className="h-28 bg-[linear-gradient(135deg,#f4dcc0,#cf5f2b,#2a211d)]">
                    {community.banner_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={community.banner_url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-6">
                    <h2 className="text-2xl font-semibold">{community.name}</h2>
                    <p className="mt-4 line-clamp-3 leading-7 text-[#67564c]">
                      {community.description || "A Selah Ember fellowship space for prayer, gathering, and shared spiritual life."}
                    </p>
                    <div className="mt-4 space-y-2 text-sm text-[#67564c]">
                      <p className="flex items-center gap-2">
                        <UsersRound aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                        {formatMemberCount(community.member_count)}
                      </p>
                      {community.location ? (
                        <p className="flex items-center gap-2">
                          <MapPin aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                          {community.location}
                        </p>
                      ) : null}
                    </div>
                    <ActionButton href={`/c/${community.slug}`} variant="secondary" size="sm" className="mt-6">View community</ActionButton>
                  </div>
                </ContentCard>
              ))}
            </div>
          )}
      </PageContainer>
    </main>
  );
}
