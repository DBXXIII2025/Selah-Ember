import {
  getEventCreationAccess,
  getEventCommunityOptions,
  getEventGroupOptions,
} from "@/app/actions/events";
import { EventForm } from "@/components/events/event-form";
import { ActionButton, DetailHeader, FormShell, PageContainer } from "@/components/ui/app-ui";

type NewEventPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function NewEventPage({ searchParams }: NewEventPageProps) {
  const [access, communities, groups, params] = await Promise.all([
    getEventCreationAccess(),
    getEventCommunityOptions(),
    getEventGroupOptions(),
    searchParams,
  ]);

  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref="/events"
        backLabel="Back to events"
        eyebrow="New event"
        title="Create a fellowship event"
        description="Official community events are managed by platform engineers while the open community model is simplified."
      />
      {access.canCreate ? (
        <div className="mt-10">
          <EventForm communities={communities} groups={groups} message={params.message} />
        </div>
      ) : (
        <FormShell
          className="mt-10"
          title="Official event creation is limited"
          description={params.message || access.message}
        >
          <ActionButton href="/events">Back to events</ActionButton>
        </FormShell>
      )}
    </PageContainer>
  );
}
