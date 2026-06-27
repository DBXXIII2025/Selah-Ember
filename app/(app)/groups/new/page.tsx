import { getGroupCommunityOptions } from "@/app/actions/groups";
import { StudyGroupForm } from "@/components/groups/study-group-form";
import { DetailHeader, PageContainer } from "@/components/ui/app-ui";

type NewGroupPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function NewGroupPage({ searchParams }: NewGroupPageProps) {
  const [communities, params] = await Promise.all([getGroupCommunityOptions(), searchParams]);

  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref="/groups"
        backLabel="Back to groups"
        eyebrow="New study group"
        title="Create a Bible study group"
        description="Start a focused space for Scripture, conversation, and belonging."
      />
      <div className="mt-10">
        <StudyGroupForm communities={communities} message={params.message} />
      </div>
    </PageContainer>
  );
}
