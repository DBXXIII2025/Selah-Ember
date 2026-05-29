import { CalendarDays, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventById } from "@/app/actions/events";

type EventDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const event = await getEventById(id);

  if (!event) {
    notFound();
  }

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

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
