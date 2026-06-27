import { CalendarDays, MapPin, Plus, UsersRound } from "lucide-react";
import { deleteOwnedEvent, getVisibleEvents } from "@/app/actions/events";
import { ActionButton, Badge, ConfirmActionPanel, ContentCard, EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";

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
    <PageContainer>
      <PageHeader
        eyebrow="Events"
        title="Fellowship calendar"
        description="Keep worship nights, study gatherings, and community moments visible in one place."
        action={<ActionButton href="/events/new"><Plus aria-hidden="true" className="h-4 w-4" />New event</ActionButton>}
      />

      {events.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={CalendarDays}
          title="No events yet"
          description="Create the first event for the open community, a group, or a fellowship gathering."
          action={<ActionButton href="/events/new">Create event</ActionButton>}
        />
        ) : (
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {events.map((event) => (
              <ContentCard key={event.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold">{event.title}</h2>
                  {event.is_owner ? (
                    <Badge>Your event</Badge>
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
                    <Badge className="w-fit">{event.community_name}</Badge>
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
                    <Badge className="w-fit">You are {event.user_rsvp_status}</Badge>
                  ) : null}
                </div>
                <ActionButton href={`/events/${event.id}`} variant="secondary" size="sm" className="mt-6">Open event</ActionButton>
                {event.is_owner ? (
                  <ConfirmActionPanel
                    action={deleteOwnedEvent}
                    hiddenFields={{ event_id: event.id }}
                    title="Delete this event"
                    description="This removes the event and its RSVP context. This action cannot be undone."
                    actionLabel="Delete event"
                    confirmationId={`delete-event-${event.id}`}
                    className="mt-5"
                  />
                ) : null}
              </ContentCard>
            ))}
          </div>
        )}
    </PageContainer>
  );
}
