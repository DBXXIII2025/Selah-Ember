import Link from "next/link";
import { notFound } from "next/navigation";
import { getGivingForLeader } from "@/app/actions/giving";
import { GivingCampaignForm } from "@/components/giving/giving-campaign-form";

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
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <Link href={`/leader/communities/${id}/giving`} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to giving
        </Link>
        <h1 className="mt-3 text-4xl font-semibold">New giving campaign</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[#67564c]">Payments are not live yet. This creates a giving campaign foundation.</p>
        <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
          <GivingCampaignForm communityId={id} returnTo={`/leader/communities/${id}/giving`} />
        </div>
      </div>
    </section>
  );
}
