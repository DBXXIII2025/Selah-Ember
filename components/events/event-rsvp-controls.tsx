import {
  removeEventRsvp,
  setEventRsvp,
  type EventRecord,
  type EventRsvpStatus,
} from "@/app/actions/events";

type EventRsvpControlsProps = {
  event: EventRecord;
  status: EventRsvpStatus;
};

function rsvpButtonClassName(active: boolean) {
  return active
    ? "rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
    : "rounded-full border border-[#2f2722]/20 bg-white/70 px-5 py-3 text-sm font-semibold text-[#2f2722] shadow-sm transition hover:bg-white";
}

export function EventRsvpControls({ event, status }: EventRsvpControlsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <form action={setEventRsvp}>
        <input type="hidden" name="event_id" value={event.id} />
        <input type="hidden" name="status" value="going" />
        <button type="submit" className={rsvpButtonClassName(status.status === "going")}>
          Going
        </button>
      </form>
      <form action={setEventRsvp}>
        <input type="hidden" name="event_id" value={event.id} />
        <input type="hidden" name="status" value="interested" />
        <button type="submit" className={rsvpButtonClassName(status.status === "interested")}>
          Interested
        </button>
      </form>
      {status.status ? (
        <form action={removeEventRsvp}>
          <input type="hidden" name="event_id" value={event.id} />
          <button
            type="submit"
            className="rounded-full border border-[#2f2722]/20 bg-white/70 px-5 py-3 text-sm font-semibold text-[#2f2722] shadow-sm transition hover:bg-white"
          >
            Not Going / Remove RSVP
          </button>
        </form>
      ) : null}
    </div>
  );
}
