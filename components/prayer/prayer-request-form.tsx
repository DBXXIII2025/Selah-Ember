import { createPrayerRequest, type PrayerCommunityOption } from "@/app/actions/prayer";
import {
  ActionButton,
  FormActions,
  FormError,
  FormField,
  FormHint,
  FormLabel,
  FormSection,
  FormShell,
  formControlClassName,
} from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";

type PrayerRequestFormProps = {
  communities: PrayerCommunityOption[];
  message?: string;
};

export function PrayerRequestForm({ communities, message }: PrayerRequestFormProps) {
  return (
    <FormShell
      title="Share a prayer request"
      description="Give enough context for thoughtful prayer while sharing only what feels appropriate."
    >
      {message ? <FormError className="mb-6">{message}</FormError> : null}

      <form action={createPrayerRequest}>
        <FormSection>
          <FormField>
            <FormLabel htmlFor="prayer-title" required>Title</FormLabel>
            <input id="prayer-title" required name="title" type="text" autoComplete="off" className={formControlClassName} />
            <FormHint>Use a short, clear summary of the request.</FormHint>
          </FormField>
          <FormField>
            <FormLabel htmlFor="prayer-content" required>Prayer request</FormLabel>
            <textarea id="prayer-content" required name="content" rows={5} className={formControlClassName} />
          </FormField>
          <FormField>
            <FormLabel htmlFor="prayer-community">Community</FormLabel>
            <select id="prayer-community" name="community_id" className={formControlClassName} defaultValue="">
            <option value="">No community</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
            </select>
            <FormHint>Optional. Leave blank to keep the request independent of a legacy community space.</FormHint>
          </FormField>
          <label className="flex items-start gap-3 rounded-xl border border-[#d9c1ad] bg-[#fffaf4] px-4 py-4">
            <input name="is_private" type="checkbox" className="mt-0.5 h-4 w-4 accent-[#a94720]" />
          <span>
              <span className="block text-sm font-semibold text-[#3b312b]">Private request</span>
            <span className="block text-sm text-[#67564c]">Only you will see this request.</span>
          </span>
          </label>
        </FormSection>
        <FormActions className="mt-7">
          <ActionButton href="/prayer" variant="secondary">Cancel</ActionButton>
          <SubmitButton pendingLabel="Creating request…">Create request</SubmitButton>
        </FormActions>
      </form>
    </FormShell>
  );
}
