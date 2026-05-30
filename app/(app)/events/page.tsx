import { CalendarDays, MapPin, Plus, UsersRound } from "lucide-react";
import Link from "next/link";
import { getVisibleEvents } from "@/app/actions/events";

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRsvpCount(count: number, label: string) {
  return `${count} ${label}`;
}

export default async function EventsPage() {
  const events = await getVisibleEvents();

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
              Events
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Fellowship calendar</h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
              Keep worship nights, study gatherings, and church moments visible in one place.
            </p>
          </div>
          <Link
            href="/events/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            New event
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
              <CalendarDays aria-hidden="true" className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold">No events yet</h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
              Create the first event for a church community, group, or fellowship gathering.
            </p>
            <Link
              href="/events/new"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b94f22]"
            >
              Create event
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {events.map((event) => (
              <article key={event.id} className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold">{event.title}</h2>
                  {event.is_owner ? (
                    <span className="rounded-full bg-[#fff4e8] px-3 py-1 text-xs font-semibold text-[#8a3f1e]">
                      Your event
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 leading-7 text-[#67564c]">
                  {event.description || "A simple event foundation ready for fellowship."}
                </p>
                <div className="mt-5 space-y-2 text-sm text-[#67564c]">
                  <p className="flex items-center gap-2">
                    <CalendarDays aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                    {formatEventTime(event.event_time)}
                  </p>
                  {event.location ? (
                    <p className="flex items-center gap-2">
                      <MapPin aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                      {event.location}
                    </p>
                  ) : null}
                  {event.community_name ? (
                    <p className="rounded-full bg-[#ffe2cb] px-3 py-1 font-medium text-[#8a3f1e]">
                      {event.community_name}
                    </p>
                  ) : null}
                  {event.group_title ? (
                    <p className="flex items-center gap-2">
                      <UsersRound aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                      {event.group_title}
                    </p>
                  ) : null}
                  <p className="flex items-center gap-2">
                    <UsersRound aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                    {formatRsvpCount(event.rsvp_counts.going, "going")} ·{" "}
                    {formatRsvpCount(event.rsvp_counts.interested, "interested")}
                  </p>
                  {event.user_rsvp_status ? (
                    <p className="rounded-full bg-[#fff4e8] px-3 py-1 font-medium text-[#8a3f1e]">
                      You are {event.user_rsvp_status}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/events/${event.id}`}
                  className="mt-6 inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
                >
                  Open event
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
