import { updateOwnedCommunity, type LeaderCommunity } from "@/app/actions/leader";
import {
  FormActions,
  FormField,
  FormHint,
  FormLabel,
  FormSection,
  formControlClassName,
} from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";

type CommunityEditFormProps = {
  community: LeaderCommunity;
};

export function CommunityEditForm({ community }: CommunityEditFormProps) {
  return (
    <form action={updateOwnedCommunity}>
      <input type="hidden" name="community_id" value={community.id} />
      <FormSection>
      <FormField>
        <FormLabel htmlFor="managed-community-name" required>Community name</FormLabel>
        <input id="managed-community-name" required name="name" type="text" defaultValue={community.name} className={formControlClassName} />
      </FormField>
      <FormField>
        <FormLabel htmlFor="managed-community-description">Description</FormLabel>
        <input
          id="managed-community-description"
          name="description"
          type="text"
          defaultValue={community.description || ""}
          className={formControlClassName}
        />
      </FormField>
      <FormField>
        <FormLabel htmlFor="managed-community-location">Location</FormLabel>
        <input id="managed-community-location" name="location" type="text" defaultValue={community.location || ""} className={formControlClassName} />
      </FormField>
      <FormField>
        <FormLabel htmlFor="managed-community-banner">Banner URL</FormLabel>
        <input
          id="managed-community-banner"
          name="banner_url"
          type="url"
          defaultValue={community.banner_url || ""}
          className={formControlClassName}
        />
        <FormHint>Optional. Use a secure image URL for the existing public page banner.</FormHint>
      </FormField>
      </FormSection>
      <FormActions className="mt-7">
        <SubmitButton pendingLabel="Saving details…">Save details</SubmitButton>
      </FormActions>
    </form>
  );
}
