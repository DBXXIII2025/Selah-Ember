import {
  createEvent,
  type EventCommunityOption,
  type EventGroupOption,
} from "@/app/actions/events";
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

type EventFormProps = {
  communities: EventCommunityOption[];
  groups: EventGroupOption[];
  message?: string;
};

export function EventForm({ communities, groups, message }: EventFormProps) {
  return (
    <FormShell
      title="Event details"
      description="Add the essential gathering information. Members can review the details before responding."
    >
      {message ? <FormError className="mb-6">{message}</FormError> : null}

      <form action={createEvent}>
        <FormSection title="Gathering">
          <FormField>
            <FormLabel htmlFor="event-title" required>Title</FormLabel>
            <input id="event-title" required name="title" type="text" className={formControlClassName} />
          </FormField>
          <FormField>
            <FormLabel htmlFor="event-description">Description</FormLabel>
            <textarea id="event-description" name="description" rows={4} className={formControlClassName} />
            <FormHint>Include what attendees should expect and anything they should bring.</FormHint>
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField>
              <FormLabel htmlFor="event-time" required>Event time</FormLabel>
              <input id="event-time" required name="event_time" type="datetime-local" className={formControlClassName} />
            </FormField>
            <FormField>
              <FormLabel htmlFor="event-location">Location</FormLabel>
              <input id="event-location" name="location" type="text" className={formControlClassName} />
            </FormField>
          </div>
        </FormSection>
        <FormSection title="Visibility and group" description="Official events require an eligible community." className="mt-8 border-t border-[#ead6c5] pt-7">
          <FormField>
            <FormLabel htmlFor="event-community" required>Community</FormLabel>
            <select id="event-community" name="community_id" className={formControlClassName} defaultValue="" required>
              <option value="">Choose a community</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>{community.name}</option>
              ))}
            </select>
          </FormField>
          <FormField>
            <FormLabel htmlFor="event-group">Study group</FormLabel>
            <select id="event-group" name="group_id" className={formControlClassName} defaultValue="">
              <option value="">No study group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.title}</option>
              ))}
            </select>
            <FormHint>Optional. Attach this event when it belongs to a specific group.</FormHint>
          </FormField>
        </FormSection>
        <FormActions className="mt-7">
          <ActionButton href="/events" variant="secondary">Cancel</ActionButton>
          <SubmitButton pendingLabel="Creating event…">Create event</SubmitButton>
        </FormActions>
      </form>
    </FormShell>
  );
}
