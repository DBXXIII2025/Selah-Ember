import { CalendarDays, MapPin, Plus, UsersRound } from "lucide-react";
import { deleteOwnedEvent, getVisibleEvents } from "@/app/actions/events";
import { ActionButton, Badge, ContentCard, EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";

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
                  <form action={deleteOwnedEvent} className="mt-4 border-t border-[#ead6c5] pt-4">
                    <input type="hidden" name="event_id" value={event.id} />
                    <p className="text-xs text-[#67564c]">Type DELETE to remove this event.</p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input
                        name="confirmation"
                        type="text"
                        placeholder="DELETE"
                        className="rounded-xl border border-[#ead6c5] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10"
                      />
                      <ActionButton type="submit" variant="danger">Delete event</ActionButton>
                    </div>
                  </form>
                ) : null}
              </ContentCard>
            ))}
          </div>
        )}
    </PageContainer>
  );
}
