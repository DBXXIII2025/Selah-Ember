import Link from "next/link";
import {
  getEventCreationAccess,
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
  const [access, communities, groups, params] = await Promise.all([
    getEventCreationAccess(),
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
        {access.canCreate ? (
          <>
            <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
              Official community events are managed by platform engineers while the open community model is simplified.
            </p>
            <div className="mt-10">
              <EventForm communities={communities} groups={groups} message={params.message} />
            </div>
          </>
        ) : (
          <div className="mt-10 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Official event creation is limited</h2>
            <p className="mt-3 leading-7 text-[#67564c]">{params.message || access.message}</p>
            <Link href="/events" className="mt-6 inline-flex rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
              Back to events
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
