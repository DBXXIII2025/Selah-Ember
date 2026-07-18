import { StudyRoomCreateForm } from "@/components/study-rooms/study-room-create-form";
import { DetailHeader, PageContainer } from "@/components/ui/app-ui";

type NewStudyRoomPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function NewStudyRoomPage({ searchParams }: NewStudyRoomPageProps) {
  const { message } = await searchParams;

  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref="/study-rooms"
        backLabel="Back to Study Rooms"
        eyebrow="New Study Room"
        title="Create a Study Room"
        description="Start a structured Bible study space with clear membership, studies, Scripture, and long-term organization."
      />
      <div className="mt-10">
        <StudyRoomCreateForm message={message} />
      </div>
    </PageContainer>
  );
}
