import { createStudyRoom } from "@/app/actions/study-rooms";
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

type StudyRoomCreateFormProps = {
  message?: string;
};

export function StudyRoomCreateForm({ message }: StudyRoomCreateFormProps) {
  return (
    <FormShell
      title="Study Room details"
      description="Create an organized, Scripture-centered room that can grow into a long-term study archive."
    >
      {message ? <FormError className="mb-6">{message}</FormError> : null}
      <form action={createStudyRoom}>
        <FormSection>
          <FormField>
            <FormLabel htmlFor="study-room-name" required>Room name</FormLabel>
            <input id="study-room-name" name="name" type="text" required maxLength={120} className={formControlClassName} />
          </FormField>
          <FormField>
            <FormLabel htmlFor="study-room-description" required>Description</FormLabel>
            <textarea id="study-room-description" name="description" required rows={5} maxLength={5000} className={formControlClassName} />
            <FormHint>Describe the study focus, rhythm, and who the room is intended to serve.</FormHint>
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField>
              <FormLabel htmlFor="study-room-visibility" required>Visibility</FormLabel>
              <select id="study-room-visibility" name="visibility" required defaultValue="public" className={formControlClassName}>
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
              </select>
              <FormHint>Public rooms can be discovered. Unlisted rooms need a direct link. Private rooms require membership.</FormHint>
            </FormField>
            <FormField>
              <FormLabel htmlFor="study-room-membership-mode" required>Membership mode</FormLabel>
              <select id="study-room-membership-mode" name="membership_mode" required defaultValue="open_join" className={formControlClassName}>
                <option value="open_join">Open join</option>
                <option value="request_to_join">Request to join</option>
                <option value="invite_only">Invite only</option>
              </select>
              <FormHint>Choose whether people can join directly, request access, or wait for an invitation.</FormHint>
            </FormField>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField>
              <FormLabel htmlFor="study-room-topic">Study topic</FormLabel>
              <input id="study-room-topic" name="study_topic" type="text" maxLength={160} className={formControlClassName} />
            </FormField>
            <FormField>
              <FormLabel htmlFor="study-room-bible-book">Primary Bible book</FormLabel>
              <input id="study-room-bible-book" name="primary_bible_book" type="text" maxLength={80} placeholder="Romans" className={formControlClassName} />
            </FormField>
          </div>
          <FormField>
            <FormLabel htmlFor="study-room-scripture">Current Scripture reference</FormLabel>
            <input id="study-room-scripture" name="current_scripture_reference" type="text" maxLength={160} placeholder="Romans 8:28" className={formControlClassName} />
          </FormField>
          <FormField>
            <FormLabel htmlFor="study-room-cover">External cover image URL</FormLabel>
            <input id="study-room-cover" name="cover_image_url" type="url" maxLength={2048} placeholder="https://example.com/image.jpg" className={formControlClassName} />
            <FormHint>Optional. Phase 1 uses external URLs only; no file uploads.</FormHint>
          </FormField>
        </FormSection>
        <FormActions className="mt-7">
          <ActionButton href="/study-rooms" variant="secondary">Cancel</ActionButton>
          <SubmitButton pendingLabel="Creating Study Room...">Create Study Room</SubmitButton>
        </FormActions>
      </form>
    </FormShell>
  );
}
