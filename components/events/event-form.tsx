import {
  createEvent,
  type EventCommunityOption,
  type EventGroupOption,
} from "@/app/actions/events";

type EventFormProps = {
  communities: EventCommunityOption[];
  groups: EventGroupOption[];
  message?: string;
};

const fieldClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

export function EventForm({ communities, groups, message }: EventFormProps) {
  return (
    <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
      <h2 className="text-2xl font-semibold">Create event</h2>
      <p className="mt-3 leading-7 text-[#67564c]">
        Start with a simple gathering record. RSVP, recurrence, and notifications can come later.
      </p>

      {message ? (
        <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
          {message}
        </p>
      ) : null}

      <form action={createEvent} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Title</span>
          <input required name="title" type="text" className={fieldClassName} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Description</span>
          <textarea name="description" rows={4} className={fieldClassName} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Event time</span>
          <input required name="event_time" type="datetime-local" className={fieldClassName} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Location</span>
          <input name="location" type="text" className={fieldClassName} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Community</span>
          <select name="community_id" className={fieldClassName} defaultValue="">
            <option value="">No community</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Study group</span>
          <select name="group_id" className={fieldClassName} defaultValue="">
            <option value="">No study group</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-full bg-[#cf5f2b] px-6 py-3 font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
        >
          Create event
        </button>
      </form>
    </section>
  );
}
