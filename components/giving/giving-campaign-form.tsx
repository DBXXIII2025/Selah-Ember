import { createGivingCampaign, updateGivingCampaign, type GivingCampaign } from "@/app/actions/giving";

type GivingCampaignFormProps = {
  communityId: string;
  returnTo: string;
  campaign?: GivingCampaign | null;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

function centsToInput(value: number | null) {
  return value ? (value / 100).toFixed(2) : "";
}

export function GivingCampaignForm({ communityId, returnTo, campaign = null }: Readonly<GivingCampaignFormProps>) {
  return (
    <form action={campaign ? updateGivingCampaign : createGivingCampaign} className="space-y-5">
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="return_to" value={returnTo} />
      {campaign ? <input type="hidden" name="campaign_id" value={campaign.id} /> : null}

      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Campaign title</span>
        <input name="title" required maxLength={160} defaultValue={campaign?.title || ""} className={inputClassName} />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Description</span>
        <textarea name="description" rows={5} maxLength={5000} defaultValue={campaign?.description || ""} className={inputClassName} />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Goal amount</span>
        <input name="goal_amount" inputMode="decimal" placeholder="1000.00" defaultValue={centsToInput(campaign?.goal_amount_cents || null)} className={inputClassName} />
      </label>

      <label className="flex items-center gap-3 text-sm font-medium text-[#3b312b]">
        <input name="is_active" type="checkbox" defaultChecked={campaign?.is_active ?? true} className="h-4 w-4" />
        Active
      </label>

      <button type="submit" className="rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
        {campaign ? "Save campaign" : "Create campaign"}
      </button>
    </form>
  );
}
