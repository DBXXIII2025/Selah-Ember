import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicGivingCampaign } from "@/app/actions/giving";
import { getPublicCommunityBySlug } from "@/app/actions/communities";
import { GivingCampaignCard } from "@/components/giving/giving-campaign-card";
import { GivingIntentForm } from "@/components/giving/giving-intent-form";
import { BrandMark } from "@/components/ui/brand-mark";

type PublicCampaignGivingPageProps = {
  params: Promise<{ slug: string; campaignId: string }>;
  searchParams: Promise<{ message?: string }>;
};

export default async function PublicCampaignGivingPage({ params, searchParams }: PublicCampaignGivingPageProps) {
  const [{ slug, campaignId }, { message }] = await Promise.all([params, searchParams]);
  const community = await getPublicCommunityBySlug(slug);

  if (!community) {
    notFound();
  }

  const campaign = await getPublicGivingCampaign(community.id, campaignId);

  if (!campaign) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7ead7] text-[#211814]">
      <section className="px-6 py-10 sm:px-10 lg:px-16">
        <nav className="mx-auto flex max-w-7xl items-center justify-between">
          <BrandMark />
          <Link href={`/c/${slug}/give`} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">Back to giving</Link>
        </nav>
        <div className="mx-auto mt-12 max-w-4xl">
          <GivingCampaignCard campaign={campaign} />
          {message ? <p className="mt-4 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">{message}</p> : null}
          <section className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <h1 className="text-2xl font-semibold">Record giving intent</h1>
            <p className="mt-3 leading-7 text-[#67564c]">No payment will be charged. Online payments are not live yet.</p>
            <div className="mt-6">
              <GivingIntentForm communityId={community.id} slug={slug} returnTo={`/c/${slug}/give/${campaign.id}`} campaign={campaign} />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
