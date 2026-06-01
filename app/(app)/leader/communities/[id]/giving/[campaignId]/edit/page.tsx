import Link from "next/link";
import { notFound } from "next/navigation";
import { getGivingCampaignForLeader } from "@/app/actions/giving";
import { GivingCampaignForm } from "@/components/giving/giving-campaign-form";

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
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <Link href={`/leader/communities/${id}/giving`} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to giving
        </Link>
        <h1 className="mt-3 text-4xl font-semibold">Edit giving campaign</h1>
        <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
          <GivingCampaignForm communityId={id} returnTo={`/leader/communities/${id}/giving`} campaign={data.campaign} />
        </div>
      </div>
    </section>
  );
}
