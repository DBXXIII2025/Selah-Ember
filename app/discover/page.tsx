import { MapPin, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { getDiscoverCommunities } from "@/app/actions/communities";
import { BrandMark } from "@/components/ui/brand-mark";

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

      <section className="px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
              Discover
            </p>
            <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
              Find a fellowship community
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
              Browse public Selah Ember communities and join the spaces where prayer, study, and gathering are taking shape.
            </p>
          </div>

          {communities.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
                <Search aria-hidden="true" className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold">No public communities yet</h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
                New fellowship spaces will appear here as communities are created.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {communities.map((community) => (
                <article
                  key={community.id}
                  className="overflow-hidden rounded-2xl border border-[#ead6c5] bg-white/75 shadow-sm"
                >
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
                    <Link
                      href={`/c/${community.slug}`}
                      className="mt-6 inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
                    >
                      View community
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
