import Link from "next/link";
import { getPrayerCommunityOptions } from "@/app/actions/prayer";
import { PrayerRequestForm } from "@/components/prayer/prayer-request-form";

type NewPrayerPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function NewPrayerPage({ searchParams }: NewPrayerPageProps) {
  const [communities, params] = await Promise.all([getPrayerCommunityOptions(), searchParams]);

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/prayer" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to prayer
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
          New prayer request
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Invite prayerful care</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
          Share what should be carried in prayer, publicly with authenticated members or privately for your own record.
        </p>
        <div className="mt-10">
          <PrayerRequestForm communities={communities} message={params.message} />
        </div>
      </div>
    </section>
  );
}
