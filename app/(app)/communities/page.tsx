import { MapPin, Plus, UsersRound } from "lucide-react";
import Link from "next/link";
import { getCurrentUserCommunities } from "@/app/actions/communities";

export default async function CommunitiesPage() {
  const memberships = await getCurrentUserCommunities();

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
              Communities
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Your fellowship spaces</h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
              Create and gather the church communities you own or have joined.
            </p>
          </div>
          <Link
            href="/communities/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            New community
          </Link>
        </div>

        {memberships.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
              <UsersRound aria-hidden="true" className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold">No communities yet</h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
              Create your first Selah Ember community for a church, small group, or fellowship circle.
            </p>
            <Link
              href="/communities/new"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b94f22]"
            >
              Create community
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {memberships.map(({ community, role }) => (
              <article key={community.id} className="overflow-hidden rounded-2xl border border-[#ead6c5] bg-white/75 shadow-sm">
                <div className="h-28 bg-[linear-gradient(135deg,#f4dcc0,#cf5f2b,#2a211d)]">
                  {community.banner_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={community.banner_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-semibold">{community.name}</h2>
                      <p className="mt-1 text-sm font-medium text-[#b94f22]">{role}</p>
                    </div>
                  </div>
                  <p className="mt-4 line-clamp-3 leading-7 text-[#67564c]">
                    {community.description || "A quiet community foundation ready for fellowship."}
                  </p>
                  {community.location ? (
                    <p className="mt-4 flex items-center gap-2 text-sm text-[#67564c]">
                      <MapPin aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                      {community.location}
                    </p>
                  ) : null}
                  <Link
                    href={`/c/${community.slug}`}
                    className="mt-6 inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
                  >
                    View public page
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
