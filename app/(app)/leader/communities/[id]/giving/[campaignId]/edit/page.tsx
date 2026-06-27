import { notFound } from "next/navigation";
import { getGivingCampaignForLeader } from "@/app/actions/giving";
import { GivingCampaignForm } from "@/components/giving/giving-campaign-form";
import { DetailHeader, FormShell, PageContainer } from "@/components/ui/app-ui";

type EditGivingCampaignPageProps = {
  params: Promise<{ id: string; campaignId: string }>;
};

export default async function EditGivingCampaignPage({ params }: EditGivingCampaignPageProps) {
  const { id, campaignId } = await params;
  const data = await getGivingCampaignForLeader(id, campaignId);

  if (!data.community || !data.campaign) {
    notFound();
  }

  return (
    <PageContainer size="medium">
      <DetailHeader backHref={`/leader/communities/${id}/giving`} backLabel="Back to giving" eyebrow="Planning foundation" title="Edit giving campaign" description="Update this existing planning record. Payments remain disabled." />
      <FormShell className="mt-8" title="Campaign details" description="Review the record and save only the intended changes.">
          <GivingCampaignForm communityId={id} returnTo={`/leader/communities/${id}/giving`} campaign={data.campaign} />
      </FormShell>
    </PageContainer>
  );
}
