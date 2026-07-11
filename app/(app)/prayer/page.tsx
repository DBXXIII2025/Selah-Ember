import { Lock, Plus, UsersRound } from "lucide-react";
import { deleteOwnPrayerRequest, getVisiblePrayerRequests } from "@/app/actions/prayer";
import { ActionButton, Badge, ConfirmActionPanel, ContentCard, EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";

export default async function PrayerPage() {
  const requests = await getVisiblePrayerRequests();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Prayer"
        title="Prayer requests"
        description="Hold public community needs and your own private requests in a quiet, protected place."
        action={<ActionButton href="/prayer/new"><Plus aria-hidden="true" className="h-4 w-4" />New request</ActionButton>}
      />

      {requests.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={UsersRound}
          title="No prayer requests yet"
          description="Share the first request when you are ready to invite prayerful care."
          action={<ActionButton href="/prayer/new">Create request</ActionButton>}
        />
        ) : (
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {requests.map((request) => (
              <ContentCard key={request.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold">{request.title}</h2>
                  {request.is_private ? (
                    <Badge>
                      <Lock aria-hidden="true" className="h-3 w-3" />
                      Private
                    </Badge>
                  ) : (
                    <Badge tone="success">Public</Badge>
                  )}
                </div>
                <p className="mt-4 whitespace-pre-line leading-7 text-[#67564c]">{request.content}</p>
                <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#67564c]">
                  {request.community_name ? (
                    <Badge>{request.community_name}</Badge>
                  ) : null}
                  {request.is_owner ? <span>Your request</span> : <span>Community request</span>}
                </div>
                {request.can_delete ? (
                  <ConfirmActionPanel
                    action={deleteOwnPrayerRequest}
                    hiddenFields={{ request_id: request.id }}
                    title="Delete this prayer request"
                    description="This permanently removes the request from your prayer list."
                    actionLabel="Delete request"
                    confirmationId={`delete-prayer-${request.id}`}
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
