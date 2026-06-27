import { getPrayerCommunityOptions } from "@/app/actions/prayer";
import { PrayerRequestForm } from "@/components/prayer/prayer-request-form";
import { DetailHeader, PageContainer } from "@/components/ui/app-ui";

type NewPrayerPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function NewPrayerPage({ searchParams }: NewPrayerPageProps) {
  const [communities, params] = await Promise.all([getPrayerCommunityOptions(), searchParams]);

  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref="/prayer"
        backLabel="Back to prayer"
        eyebrow="New prayer request"
        title="Invite prayerful care"
        description="Share what should be carried in prayer, publicly with authenticated members or privately for your own record."
      />
      <div className="mt-10">
        <PrayerRequestForm communities={communities} message={params.message} />
      </div>
    </PageContainer>
  );
}
