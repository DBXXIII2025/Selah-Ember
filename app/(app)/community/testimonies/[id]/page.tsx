import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommunityTestimony } from "@/app/actions/community-topics";
import { TestimonyDeletePanel, TestimonyDetail, TestimonyReportForm } from "@/components/community/community-topic-components";
import { DetailHeader, PageContainer } from "@/components/ui/app-ui";

type TestimonyPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
};

export const dynamic = "force-dynamic";

export default async function TestimonyPage({ params, searchParams }: TestimonyPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const testimony = await getCommunityTestimony(id);
  if (!testimony) notFound();

  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref={testimony.topic_slug ? `/community/topics/${testimony.topic_slug}` : "/community/testimonies"}
        backLabel={testimony.topic_name ? `Back to ${testimony.topic_name}` : "Back to testimonies"}
        eyebrow="Personal testimony"
        title="Community testimony"
        description={query.message}
      >
        <nav aria-label="Breadcrumb" className="text-sm font-semibold text-[#67564c]">
          <Link href="/community" className="hover:text-[#8a3f1e]">Community</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/community/testimonies" className="hover:text-[#8a3f1e]">Testimonies</Link>
        </nav>
      </DetailHeader>
      <div className="mt-8 space-y-6">
        <TestimonyDetail testimony={testimony} />
        <TestimonyReportForm testimonyId={testimony.id} />
        <TestimonyDeletePanel testimony={testimony} />
      </div>
    </PageContainer>
  );
}
