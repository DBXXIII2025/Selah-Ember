import Link from "next/link";
import type { GivingCampaign } from "@/app/actions/giving";
import { formatCents } from "@/lib/giving/format";

type GivingCampaignCardProps = {
  campaign: GivingCampaign;
  href?: string;
  editHref?: string;
};

export function GivingCampaignCard({ campaign, href, editHref }: Readonly<GivingCampaignCardProps>) {
  const percent =
    campaign.goal_amount_cents && campaign.goal_amount_cents > 0
      ? Math.min(100, Math.round((campaign.total_completed_cents / campaign.goal_amount_cents) * 100))
      : null;

  return (
    <article className="rounded-2xl border border-[#ead6c5] bg-white/75 p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
            {campaign.is_active && !campaign.deleted_at ? "Active" : "Inactive"}
          </p>
          {href ? (
            <Link href={href} className="mt-3 block text-2xl font-semibold hover:text-[#b94f22]">
              {campaign.title}
            </Link>
          ) : (
            <h2 className="mt-3 text-2xl font-semibold">{campaign.title}</h2>
          )}
        </div>
        {editHref ? (
          <Link href={editHref} className="rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]">
            Edit
          </Link>
        ) : null}
      </div>

      {campaign.description ? <p className="mt-4 whitespace-pre-wrap leading-7 text-[#67564c]">{campaign.description}</p> : null}

      <div className="mt-5 rounded-xl bg-[#fff4e8] p-4">
        <p className="text-sm font-semibold text-[#8a3f1e]">Completed giving recorded</p>
        <p className="mt-1 text-2xl font-semibold">{formatCents(campaign.total_completed_cents, campaign.currency)}</p>
        {campaign.goal_amount_cents ? (
          <p className="mt-1 text-sm text-[#67564c]">
            Goal {formatCents(campaign.goal_amount_cents, campaign.currency)}
            {percent !== null ? ` · ${percent}%` : ""}
          </p>
        ) : null}
      </div>

      <p className="mt-4 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
        Payments are not live yet.
      </p>
    </article>
  );
}
