import Link from "next/link";
import {
  getEventCommunityOptions,
  getEventGroupOptions,
} from "@/app/actions/events";
import { EventForm } from "@/components/events/event-form";

type NewEventPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function NewEventPage({ searchParams }: NewEventPageProps) {
  const [communities, groups, params] = await Promise.all([
    getEventCommunityOptions(),
    getEventGroupOptions(),
    searchParams,
  ]);

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/events" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to events
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
          New event
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Create a fellowship event</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
          Add the core details for a gathering without adding RSVP or recurring event logic yet.
        </p>
        <div className="mt-10">
          <EventForm communities={communities} groups={groups} message={params.message} />
        </div>
      </div>
    </section>
  );
}
