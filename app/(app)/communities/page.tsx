import { MapPin, UsersRound } from "lucide-react";
import { deleteOwnedCommunity, getCurrentUserCommunities } from "@/app/actions/communities";
import { ActionButton, ConfirmActionPanel, ContentCard, EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";

function formatMemberCount(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

export default async function CommunitiesPage() {
  const memberships = await getCurrentUserCommunities();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Communities"
        title="Your fellowship spaces"
        description="Selah Ember now centers one open community feed. Historical community memberships are shown below when present."
        action={<ActionButton href="/community">Open community</ActionButton>}
      />

      {memberships.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={UsersRound}
          title="Use the open community"
          description="Post in the main feed or create a Bible study group—no separate organization space is required."
          action={<ActionButton href="/community">Open community</ActionButton>}
        />
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {memberships.map(({ community, role }) => (
              <ContentCard key={community.id} className="overflow-hidden p-0">
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
                  <p className="mt-3 flex items-center gap-2 text-sm text-[#67564c]">
                    <UsersRound aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
                    {formatMemberCount(community.member_count)}
                  </p>
                  <ActionButton href={`/c/${community.slug}`} variant="secondary" size="sm" className="mt-6">View public page</ActionButton>
                  {role === "owner" ? (
                    <ConfirmActionPanel
                      action={deleteOwnedCommunity}
                      hiddenFields={{ community_id: community.id }}
                      title="Delete this legacy community"
                      description="This permanently removes the community record and its attached management data."
                      actionLabel="Delete community"
                      confirmationId={`delete-community-${community.id}`}
                      className="mt-5"
                    />
                  ) : null}
                </div>
              </ContentCard>
            ))}
          </div>
        )}
    </PageContainer>
  );
}
