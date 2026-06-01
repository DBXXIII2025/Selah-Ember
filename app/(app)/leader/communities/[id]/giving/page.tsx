import Link from "next/link";
import { notFound } from "next/navigation";
import { deactivateGivingCampaign, getGivingForLeader } from "@/app/actions/giving";
import { GivingCampaignCard } from "@/components/giving/giving-campaign-card";
import { formatCents } from "@/lib/giving/format";

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
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link href={`/leader/communities/${id}`} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
              Back to community management
            </Link>
            <h1 className="mt-3 text-4xl font-semibold">Giving</h1>
            <p className="mt-3 max-w-2xl leading-7 text-[#67564c]">
              Manage giving campaigns and review non-payment giving intents for {data.community.name}.
            </p>
          </div>
          <Link href={`/leader/communities/${id}/giving/new`} className="inline-flex rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
            New campaign
          </Link>
        </div>

        <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
          Payments not live yet. Giving intents are recorded for preparation only.
        </p>
        {message ? <p className="mt-4 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">{message}</p> : null}

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {data.campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center lg:col-span-2">
              <h2 className="text-2xl font-semibold">No giving campaigns yet</h2>
            </div>
          ) : (
            data.campaigns.map((campaign) => (
              <div key={campaign.id} className="space-y-3">
                <GivingCampaignCard campaign={campaign} editHref={`/leader/communities/${id}/giving/${campaign.id}/edit`} />
                <form action={deactivateGivingCampaign} className="flex flex-col gap-3 sm:flex-row">
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <input type="hidden" name="community_id" value={id} />
                  <input type="hidden" name="return_to" value={`/leader/communities/${id}/giving`} />
                  <input name="confirmation" type="text" placeholder="DELETE" className="rounded-xl border border-[#ead6c5] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10" />
                  <button type="submit" className="rounded-full border border-[#b42318]/30 bg-white px-4 py-2 text-sm font-semibold text-[#b42318] transition hover:bg-[#fff1f0]">
                    Deactivate
                  </button>
                </form>
              </div>
            ))
          )}
        </div>

        <section className="mt-10 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Recent giving intents</h2>
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
        </section>
      </div>
    </section>
  );
}
