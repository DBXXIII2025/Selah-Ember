import { createGivingIntent, type GivingCampaign } from "@/app/actions/giving";

type GivingIntentFormProps = {
  communityId: string;
  slug: string;
  returnTo: string;
  campaign?: GivingCampaign | null;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#a94720] focus:ring-4 focus:ring-[#a94720]/10";

export function GivingIntentForm({ communityId, slug, returnTo, campaign = null }: Readonly<GivingIntentFormProps>) {
  return (
    <form action={createGivingIntent} className="space-y-5">
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="return_to" value={returnTo} />
      {campaign ? <input type="hidden" name="campaign_id" value={campaign.id} /> : null}

      <div className="rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
        Giving is being prepared. Online payments are not live yet. No card or bank information is collected here.
      </div>

      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Donation amount</span>
        <input name="amount" required inputMode="decimal" placeholder="25.00" className={inputClassName} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Name</span>
          <input name="giver_name" className={inputClassName} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Email</span>
          <input name="giver_email" type="email" className={inputClassName} />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Note</span>
        <textarea name="note" rows={4} maxLength={1000} className={inputClassName} />
      </label>

      <button type="submit" className="rounded-full bg-[#a94720] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#a94720]/20 transition hover:bg-[#b94f22]">
        Record giving intent
      </button>
    </form>
  );
}
