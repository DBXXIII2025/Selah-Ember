import { notFound } from "next/navigation";
import { getGivingForLeader } from "@/app/actions/giving";
import { GivingCampaignForm } from "@/components/giving/giving-campaign-form";
import { DetailHeader, FormShell, PageContainer } from "@/components/ui/app-ui";

type NewGivingCampaignPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewGivingCampaignPage({ params }: NewGivingCampaignPageProps) {
  const { id } = await params;
  const data = await getGivingForLeader(id);

  if (!data.community) {
    notFound();
  }

  return (
    <PageContainer size="medium">
      <DetailHeader backHref={`/leader/communities/${id}/giving`} backLabel="Back to giving" eyebrow="Planning foundation" title="New giving campaign" description="Payments are not live. This creates a planning record only." />
      <FormShell className="mt-8" title="Campaign details" description="Define the purpose and optional target amount for this planning record.">
          <GivingCampaignForm communityId={id} returnTo={`/leader/communities/${id}/giving`} />
      </FormShell>
    </PageContainer>
  );
}
