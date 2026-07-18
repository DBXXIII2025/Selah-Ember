import { LoadingState, PageContainer, PageHeader } from "@/components/ui/app-ui";

export default function StudyRoomsLoading() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Study Rooms"
        title="Study Rooms"
        description="Loading structured Bible study spaces."
      />
      <LoadingState className="mt-10" rows={4} />
    </PageContainer>
  );
}
