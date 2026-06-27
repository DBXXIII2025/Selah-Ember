import Link from "next/link";
import type { GivingCampaign } from "@/app/actions/giving";
import { formatCents } from "@/lib/giving/format";
import { ActionButton, Badge, ContentCard, FormNotice } from "@/components/ui/app-ui";

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
    <ContentCard>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <Badge tone={campaign.is_active && !campaign.deleted_at ? "success" : "neutral"}>
            {campaign.is_active && !campaign.deleted_at ? "Active" : "Inactive"}
          </Badge>
          {href ? (
            <Link href={href} className="mt-3 block text-2xl font-semibold hover:text-[#b94f22]">
              {campaign.title}
            </Link>
          ) : (
            <h2 className="mt-3 text-2xl font-semibold">{campaign.title}</h2>
          )}
        </div>
        {editHref ? (
          <ActionButton href={editHref} variant="secondary" size="sm">Edit</ActionButton>
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

      <FormNotice className="mt-4">Payments are not live yet.</FormNotice>
    </ContentCard>
  );
}
