import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicGivingCampaigns } from "@/app/actions/giving";
import { getPublicCommunityBySlug } from "@/app/actions/communities";
import { GivingCampaignCard } from "@/components/giving/giving-campaign-card";
import { GivingIntentForm } from "@/components/giving/giving-intent-form";
import { BrandMark } from "@/components/ui/brand-mark";

type PublicGivingPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string }>;
};

export default async function PublicGivingPage({ params, searchParams }: PublicGivingPageProps) {
  const [{ slug }, { message }] = await Promise.all([params, searchParams]);
  const community = await getPublicCommunityBySlug(slug);

  if (!community) {
    notFound();
  }

  const campaigns = await getPublicGivingCampaigns(community.id);

  return (
    <main className="min-h-screen bg-[#f7ead7] text-[#211814]">
      <section className="px-6 py-10 sm:px-10 lg:px-16">
        <nav className="mx-auto flex max-w-7xl items-center justify-between">
          <BrandMark />
          <Link href={`/c/${slug}`} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">Back to community</Link>
        </nav>
        <div className="mx-auto mt-12 max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">Giving</p>
          <h1 className="mt-3 text-5xl font-semibold">{community.name}</h1>
          <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
            Giving is being prepared. Online payments are not live yet.
          </p>
          {message ? <p className="mt-4 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">{message}</p> : null}

          <div className="mt-8 grid gap-5">
            {campaigns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
                <h2 className="text-2xl font-semibold">No active giving campaigns</h2>
                <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">Check back later for official giving opportunities.</p>
              </div>
            ) : (
              campaigns.map((campaign) => (
                <GivingCampaignCard key={campaign.id} campaign={campaign} href={`/c/${slug}/give/${campaign.id}`} />
              ))
            )}
          </div>

          <section className="mt-10 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">General giving intent</h2>
            <p className="mt-3 leading-7 text-[#67564c]">This records interest only and does not charge a payment method.</p>
            <div className="mt-6">
              <GivingIntentForm communityId={community.id} slug={slug} returnTo={`/c/${slug}/give`} />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
