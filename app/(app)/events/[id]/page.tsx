import { CalendarDays, MapPin, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { deleteOwnedEvent, getEventById, getEventRsvpStatus } from "@/app/actions/events";
import { EventRsvpControls } from "@/components/events/event-rsvp-controls";
import { ConfirmActionPanel, DetailHeader, DetailHero, FormNotice, PageContainer } from "@/components/ui/app-ui";

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
    <PageContainer>
      <div className="mx-auto max-w-5xl">
        <DetailHeader
          backHref="/events"
          backLabel="Back to events"
          eyebrow="Event"
          title={event.title}
          description={<p className="whitespace-pre-line">{event.description || "A simple gathering ready for fellowship."}</p>}
        >
          {message ? <FormNotice className="max-w-xl">{message}</FormNotice> : null}
        </DetailHeader>

        <DetailHero className="mt-8">
          <div>
            <EventRsvpControls event={event} status={rsvpStatus} />
          </div>

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
          {event.is_owner ? (
            <ConfirmActionPanel
              action={deleteOwnedEvent}
              hiddenFields={{ event_id: event.id }}
              title="Delete this event"
              description="This removes the event and returns you to the events list. This action cannot be undone."
              actionLabel="Delete event"
              className="mt-8"
            />
          ) : null}
        </DetailHero>
      </div>
    </PageContainer>
  );
}
