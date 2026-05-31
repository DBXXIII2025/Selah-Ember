import { CalendarDays, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteOwnedEvent, getEventById, getEventRsvpStatus } from "@/app/actions/events";
import { EventRsvpControls } from "@/components/events/event-rsvp-controls";

type EventDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    message?: string;
  }>;
};

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRsvpCount(count: number, label: string) {
  return `${count} ${label}`;
}

export default async function EventDetailPage({ params, searchParams }: EventDetailPageProps) {
  const { id } = await params;
  const { message } = await searchParams;
  const event = await getEventById(id);

  if (!event) {
    notFound();
  }

  const rsvpStatus = await getEventRsvpStatus(event.id);

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Link href="/events" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to events
        </Link>

        <article className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
            Event
          </p>
          <h1 className="mt-3 text-4xl font-semibold">{event.title}</h1>
          <p className="mt-4 max-w-3xl whitespace-pre-line leading-7 text-[#67564c]">
            {event.description || "A simple gathering ready for fellowship."}
          </p>
          {message ? (
            <p className="mt-6 max-w-xl rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
              {message}
            </p>
          ) : null}
          <div className="mt-8">
            <EventRsvpControls event={event} status={rsvpStatus} />
          </div>

          {event.is_owner ? (
            <form action={deleteOwnedEvent} className="mt-6 border-t border-[#ead6c5] pt-6">
              <input type="hidden" name="event_id" value={event.id} />
              <p className="text-sm text-[#67564c]">Type DELETE to remove this event.</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  name="confirmation"
                  type="text"
                  placeholder="DELETE"
                  className="rounded-xl border border-[#ead6c5] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10"
                />
                <button
                  type="submit"
                  className="rounded-full border border-[#b42318]/30 bg-white px-5 py-3 text-sm font-semibold text-[#b42318] transition hover:bg-[#fff1f0]"
                >
                  Delete event
                </button>
              </div>
            </form>
          ) : null}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#fff4e8] p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3f1e]">
                <UsersRound aria-hidden="true" className="h-4 w-4" />
                RSVP summary
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatRsvpCount(event.rsvp_counts.going, "going")} ·{" "}
                {formatRsvpCount(event.rsvp_counts.interested, "interested")}
              </p>
            </div>
            <div className="rounded-2xl bg-[#fff4e8] p-5">
              <p className="text-sm font-semibold text-[#8a3f1e]">Your RSVP</p>
              <p className="mt-2 text-lg font-semibold">
                {rsvpStatus.status || (rsvpStatus.isSignedIn ? "No RSVP yet" : "Sign in to RSVP")}
              </p>
            </div>
            <div className="rounded-2xl bg-[#fff4e8] p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3f1e]">
                <CalendarDays aria-hidden="true" className="h-4 w-4" />
                Event time
              </p>
              <p className="mt-2 text-lg font-semibold">{formatEventTime(event.event_time)}</p>
            </div>
            {event.location ? (
              <div className="rounded-2xl bg-[#fff4e8] p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3f1e]">
                  <MapPin aria-hidden="true" className="h-4 w-4" />
                  Location
                </p>
                <p className="mt-2 text-lg font-semibold">{event.location}</p>
              </div>
            ) : null}
            {event.community_name ? (
              <div className="rounded-2xl bg-[#fff4e8] p-5">
                <p className="text-sm font-semibold text-[#8a3f1e]">Community</p>
                <p className="mt-2 text-lg font-semibold">{event.community_name}</p>
              </div>
            ) : null}
            {event.group_title ? (
              <div className="rounded-2xl bg-[#fff4e8] p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3f1e]">
                  <UsersRound aria-hidden="true" className="h-4 w-4" />
                  Study group
                </p>
                <p className="mt-2 text-lg font-semibold">{event.group_title}</p>
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
