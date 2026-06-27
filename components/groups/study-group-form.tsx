import { createStudyGroup, type GroupCommunityOption } from "@/app/actions/groups";
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

type StudyGroupFormProps = {
  communities: GroupCommunityOption[];
  message?: string;
};

export function StudyGroupForm({ communities, message }: StudyGroupFormProps) {
  return (
    <FormShell
      title="Group details"
      description="Create a clear, welcoming starting point for Scripture-centered conversation and fellowship."
    >
      {message ? <FormError className="mb-6">{message}</FormError> : null}

      <form action={createStudyGroup}>
        <FormSection>
          <FormField>
            <FormLabel htmlFor="group-title" required>Title</FormLabel>
            <input id="group-title" required name="title" type="text" className={formControlClassName} />
          </FormField>
          <FormField>
            <FormLabel htmlFor="group-description">Description</FormLabel>
            <textarea id="group-description" name="description" rows={4} className={formControlClassName} />
            <FormHint>Describe the study focus, intended rhythm, or who the group may serve.</FormHint>
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField>
              <FormLabel htmlFor="group-meeting-time">Meeting time</FormLabel>
              <input id="group-meeting-time" name="meeting_time" type="text" placeholder="Thursdays at 7:00 PM" className={formControlClassName} />
            </FormField>
            <FormField>
              <FormLabel htmlFor="group-location">Location</FormLabel>
              <input id="group-location" name="location" type="text" placeholder="Online or meeting place" className={formControlClassName} />
            </FormField>
          </div>
          <FormField>
            <FormLabel htmlFor="group-community">Community</FormLabel>
            <select id="group-community" name="community_id" className={formControlClassName} defaultValue="">
              <option value="">No community</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>{community.name}</option>
              ))}
            </select>
            <FormHint>Optional. Most groups can remain part of the open Selah Ember community.</FormHint>
          </FormField>
        </FormSection>
        <FormActions className="mt-7">
          <ActionButton href="/groups" variant="secondary">Cancel</ActionButton>
          <SubmitButton pendingLabel="Creating group…">Create group</SubmitButton>
        </FormActions>
      </form>
    </FormShell>
  );
}
