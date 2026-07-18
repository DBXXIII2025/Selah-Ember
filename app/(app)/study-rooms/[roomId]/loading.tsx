import { LoadingState, PageContainer, PageHeader } from "@/components/ui/app-ui";

export default function StudyRoomDetailLoading() {
  return (
    <PageContainer>
      <PageHeader title="Study Room" description="Loading this Study Room." />
      <LoadingState className="mt-10" rows={5} />
    </PageContainer>
  );
}
