import { Lock, Plus, UsersRound } from "lucide-react";
import Link from "next/link";
import { getVisiblePrayerRequests } from "@/app/actions/prayer";

export default async function PrayerPage() {
  const requests = await getVisiblePrayerRequests();

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
              Prayer
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Prayer requests</h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
              Hold public community needs and your own private requests in a quiet, protected place.
            </p>
          </div>
          <Link
            href="/prayer/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            New request
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
              <UsersRound aria-hidden="true" className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold">No prayer requests yet</h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
              Share the first request when you are ready to invite prayerful care.
            </p>
            <Link
              href="/prayer/new"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b94f22]"
            >
              Create request
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {requests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold">{request.title}</h2>
                  {request.is_private ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4e8] px-3 py-1 text-xs font-semibold text-[#8a3f1e]">
                      <Lock aria-hidden="true" className="h-3 w-3" />
                      Private
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#eef7ee] px-3 py-1 text-xs font-semibold text-[#386641]">
                      Public
                    </span>
                  )}
                </div>
                <p className="mt-4 whitespace-pre-line leading-7 text-[#67564c]">{request.content}</p>
                <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#67564c]">
                  {request.community_name ? (
                    <span className="rounded-full bg-[#ffe2cb] px-3 py-1 font-medium text-[#8a3f1e]">
                      {request.community_name}
                    </span>
                  ) : null}
                  {request.is_owner ? <span>Your request</span> : <span>Community request</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
