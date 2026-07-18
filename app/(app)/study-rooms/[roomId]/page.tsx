import { notFound } from "next/navigation";
import { getStudyRoomDetail, searchStudyRoomInviteProfiles } from "@/app/actions/study-rooms";
import { StudyRoomDetail } from "@/components/study-rooms/study-room-detail";
import {
  ActionButton,
  Badge,
  DetailHeader,
  EmptyState,
  FormNotice,
  PageContainer,
} from "@/components/ui/app-ui";
import { isStudyRoomUuid } from "@/lib/study-rooms/validation";

type StudyRoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
  searchParams: Promise<{
    section?: string;
    message?: string;
    invite_q?: string;
    notes_sort?: string;
    prayer_status?: string;
    prayer_category?: string;
    resource_type?: string;
    saved?: string;
  }>;
};

export default async function StudyRoomPage({ params, searchParams }: StudyRoomPageProps) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);

  if (!isStudyRoomUuid(roomId)) {
    notFound();
  }

  const data = await getStudyRoomDetail(roomId);
  const inviteResults =
    query.section === "members" && query.invite_q && query.invite_q.trim().length >= 3 && data.viewer.canLead
      ? await searchStudyRoomInviteProfiles(roomId, query.invite_q)
      : [];

  if (!data.room) {
    return (
      <PageContainer size="medium">
        <DetailHeader backHref="/study-rooms" backLabel="Back to Study Rooms" title="Study Room unavailable" />
        <EmptyState
          className="mt-8"
          title="This Study Room cannot be opened"
          description="It may not exist, may be private, or may no longer be available to your account."
          action={<ActionButton href="/study-rooms">Back to Study Rooms</ActionButton>}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <DetailHeader
        backHref="/study-rooms"
        backLabel="Back to Study Rooms"
        eyebrow="Study Room"
        title={data.room.name}
        description={data.room.study_topic || data.room.primary_bible_book || "Structured Bible study space"}
      >
        <div className="flex flex-wrap gap-2">
          {data.viewer.role ? <Badge>{data.viewer.role}</Badge> : null}
          {data.viewer.isPlatformEngineer ? <Badge tone="solid">Platform access</Badge> : null}
        </div>
        {query.message ? <FormNotice className="mt-4 max-w-2xl">{query.message}</FormNotice> : null}
      </DetailHeader>
      <StudyRoomDetail
        data={data}
        activeSection={query.section || "overview"}
        inviteQuery={query.invite_q || ""}
        inviteResults={inviteResults}
        filters={{
          notesSort: query.notes_sort || "newest",
          prayerStatus: query.prayer_status || "all",
          prayerCategory: query.prayer_category || "all",
          resourceType: query.resource_type || "all",
          saved: query.saved === "1",
        }}
      />
    </PageContainer>
  );
}
