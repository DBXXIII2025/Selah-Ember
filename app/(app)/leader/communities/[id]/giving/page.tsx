import { HandCoins } from "lucide-react";
import { notFound } from "next/navigation";
import { deactivateGivingCampaign, getGivingForLeader } from "@/app/actions/giving";
import { GivingCampaignCard } from "@/components/giving/giving-campaign-card";
import { formatCents } from "@/lib/giving/format";
import { ActionButton, ConfirmActionPanel, ContentCard, DetailHeader, EmptyState, FormNotice, PageContainer, SectionHeader } from "@/components/ui/app-ui";

type LeaderGivingPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
};

export default async function LeaderGivingPage({ params, searchParams }: LeaderGivingPageProps) {
  const [{ id }, { message }] = await Promise.all([params, searchParams]);
  const data = await getGivingForLeader(id);

  if (!data.community) {
    notFound();
  }

  return (
    <PageContainer>
      <DetailHeader
        backHref={`/leader/communities/${id}`}
        backLabel="Back to management"
        eyebrow="Planning foundation"
        title="Giving"
        description={<>Manage campaign planning records and review non-payment giving intents for {data.community.name}.</>}
        action={<ActionButton href={`/leader/communities/${id}/giving/new`}>New campaign</ActionButton>}
      />

        <FormNotice className="mt-6">
          Payments not live yet. Giving intents are recorded for preparation only.
        </FormNotice>
        {message ? <FormNotice className="mt-4">{message}</FormNotice> : null}

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {data.campaigns.length === 0 ? (
            <EmptyState className="lg:col-span-2" icon={HandCoins} title="No giving campaigns yet" description="Create a planning record when a future giving initiative needs a clear purpose and goal." />
          ) : (
            data.campaigns.map((campaign) => (
              <div key={campaign.id} className="space-y-3">
                <GivingCampaignCard campaign={campaign} editHref={`/leader/communities/${id}/giving/${campaign.id}/edit`} />
                <ConfirmActionPanel
                  action={deactivateGivingCampaign}
                  hiddenFields={{ campaign_id: campaign.id, community_id: id, return_to: `/leader/communities/${id}/giving` }}
                  title="Deactivate this campaign"
                  description="The planning record is retained but will no longer be active."
                  actionLabel="Deactivate campaign"
                  confirmationId={`deactivate-campaign-${campaign.id}`}
                />
              </div>
            ))
          )}
        </div>

        <ContentCard as="section" className="mt-10">
          <SectionHeader title="Recent giving intents" description="Planning records only; no payments are processed." />
          <div className="mt-5 space-y-3">
            {data.intents.length === 0 ? (
              <p className="text-[#67564c]">No giving intents yet.</p>
            ) : (
              data.intents.map((intent) => (
                <div key={intent.id} className="rounded-xl bg-[#fff4e8] p-4 text-sm">
                  <p className="font-semibold">{formatCents(intent.amount_cents, intent.currency)} · {intent.status}</p>
                  <p className="mt-1 text-[#67564c]">
                    {intent.campaign_title || "General giving"} {intent.giver_name ? `· ${intent.giver_name}` : ""}
                  </p>
                  {intent.note ? <p className="mt-2 text-[#67564c]">{intent.note}</p> : null}
                </div>
              ))
            )}
          </div>
        </ContentCard>
    </PageContainer>
  );
}
