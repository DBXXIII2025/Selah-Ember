import { createGivingCampaign, updateGivingCampaign, type GivingCampaign } from "@/app/actions/giving";
import {
  ActionButton,
  FormActions,
  FormField,
  FormHint,
  FormLabel,
  FormSection,
  formControlClassName,
} from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";

type GivingCampaignFormProps = {
  communityId: string;
  returnTo: string;
  campaign?: GivingCampaign | null;
};

function centsToInput(value: number | null) {
  return value ? (value / 100).toFixed(2) : "";
}

export function GivingCampaignForm({ communityId, returnTo, campaign = null }: Readonly<GivingCampaignFormProps>) {
  return (
    <form action={campaign ? updateGivingCampaign : createGivingCampaign}>
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="return_to" value={returnTo} />
      {campaign ? <input type="hidden" name="campaign_id" value={campaign.id} /> : null}

      <FormSection>
      <FormField>
        <FormLabel htmlFor="campaign-title" required>Campaign title</FormLabel>
        <input id="campaign-title" name="title" required maxLength={160} defaultValue={campaign?.title || ""} className={formControlClassName} />
      </FormField>

      <FormField>
        <FormLabel htmlFor="campaign-description">Description</FormLabel>
        <textarea id="campaign-description" name="description" rows={5} maxLength={5000} defaultValue={campaign?.description || ""} className={formControlClassName} />
      </FormField>

      <FormField>
        <FormLabel htmlFor="campaign-goal">Goal amount</FormLabel>
        <input id="campaign-goal" name="goal_amount" inputMode="decimal" placeholder="1000.00" defaultValue={centsToInput(campaign?.goal_amount_cents || null)} className={formControlClassName} />
        <FormHint>Planning only. Payments are not enabled.</FormHint>
      </FormField>

      <label className="flex items-center gap-3 rounded-xl border border-[#d9c1ad] bg-[#fffaf4] px-4 py-3 text-sm font-semibold text-[#3b312b]">
        <input name="is_active" type="checkbox" defaultChecked={campaign?.is_active ?? true} className="h-4 w-4 accent-[#cf5f2b]" />
        Active
      </label>
      </FormSection>

      <FormActions className="mt-7">
        <ActionButton href={returnTo} variant="secondary">Cancel</ActionButton>
        <SubmitButton pendingLabel={campaign ? "Saving campaign…" : "Creating campaign…"}>
          {campaign ? "Save campaign" : "Create campaign"}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
