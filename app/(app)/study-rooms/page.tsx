import { BookOpenText, Plus, Search } from "lucide-react";
import { getStudyRoomsList, type StudyRoomSummary } from "@/app/actions/study-rooms";
import {
  ActionButton,
  Badge,
  ContentCard,
  EmptyState,
  FormNotice,
  PageContainer,
  PageHeader,
  SearchInput,
  SectionHeader,
  formControlClassName,
} from "@/components/ui/app-ui";
import {
  formatMembershipMode,
  formatRoomStatus,
  formatStudyRoomRole,
  formatVisibility,
} from "@/components/study-rooms/study-room-format";

type StudyRoomsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    topic?: string;
    page?: string;
    message?: string;
  }>;
};

function statusParam(value?: string) {
  if (value === "completed" || value === "archived" || value === "all") return value;
  return "active";
}

function pageParam(value?: string) {
  const page = Number(value || "1");
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function roomHref(room: StudyRoomSummary) {
  return `/study-rooms/${room.id}`;
}

function RoomCard({ room }: { room: StudyRoomSummary }) {
  return (
    <ContentCard className="flex h-full flex-col bg-white/75">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold leading-tight">
            <a href={roomHref(room)} className="break-words hover:text-[#a94720] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a94720]/15">
              {room.name}
            </a>
          </h3>
          {room.role ? <p className="mt-1 text-sm font-semibold text-[#8a3f1e]">{formatStudyRoomRole(room.role)}</p> : null}
        </div>
        <Badge tone={room.status === "active" ? "success" : room.status === "archived" ? "neutral" : "ember"}>
          {formatRoomStatus(room.status)}
        </Badge>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-6 text-[#67564c]">{room.description}</p>
      <dl className="mt-5 grid gap-3 text-sm text-[#67564c]">
        {room.study_topic ? <div><dt className="font-semibold text-[#3b312b]">Topic</dt><dd>{room.study_topic}</dd></div> : null}
        {room.primary_bible_book ? <div><dt className="font-semibold text-[#3b312b]">Bible book</dt><dd>{room.primary_bible_book}</dd></div> : null}
        {room.current_scripture_reference ? <div><dt className="font-semibold text-[#3b312b]">Current Scripture</dt><dd className="break-words">{room.current_scripture_reference}</dd></div> : null}
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        <Badge tone="neutral">{formatVisibility(room.visibility)}</Badge>
        <Badge tone="neutral">{formatMembershipMode(room.membership_mode)}</Badge>
        {room.member_count > 0 ? <Badge tone="neutral">{room.member_count} {room.member_count === 1 ? "member" : "members"}</Badge> : null}
      </div>
      <div className="mt-auto pt-6">
        <ActionButton href={roomHref(room)} variant="secondary" size="sm">Open Study Room</ActionButton>
      </div>
    </ContentCard>
  );
}

function RoomSection({
  title,
  description,
  rooms,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  rooms: StudyRoomSummary[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <section className="mt-10">
      <SectionHeader title={title} description={description} />
      {rooms.length === 0 ? (
        <EmptyState className="mt-5" icon={BookOpenText} title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => <RoomCard key={room.id} room={room} />)}
        </div>
      )}
    </section>
  );
}

export default async function StudyRoomsPage({ searchParams }: StudyRoomsPageProps) {
  const params = await searchParams;
  const status = statusParam(params.status);
  const page = pageParam(params.page);
  const q = params.q || "";
  const topic = params.topic || "";
  const data = await getStudyRoomsList(q, status, page, topic);
  const leadRooms = data.memberRooms.filter((room) => room.role === "owner" || room.role === "leader");
  const leadIds = new Set(leadRooms.map((room) => room.id));
  const myRooms = data.memberRooms.filter((room) => !leadIds.has(room.id));
  const hasPreviousPage = page > 1;
  const hasNextPage = data.memberRooms.length + data.discoverRooms.length >= data.pageSize;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Study Rooms"
        title="Study Rooms"
        description="Structured, Scripture-centered rooms for studying together over time."
        action={<ActionButton href="/study-rooms/new"><Plus aria-hidden="true" className="h-4 w-4" />Create Study Room</ActionButton>}
      />
      {params.message ? <FormNotice className="mt-6 max-w-2xl">{params.message}</FormNotice> : null}

      <ContentCard as="section" className="mt-8 bg-white/70">
        <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem_14rem_auto]" role="search">
          <SearchInput name="q" defaultValue={q} label="Search Study Rooms" placeholder="Search rooms, topics, books" />
          <label>
            <span className="sr-only">Status filter</span>
            <select name="status" defaultValue={status} className={formControlClassName}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
              <option value="all">All statuses</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Bible book or topic filter</span>
            <input name="topic" defaultValue={topic} placeholder="Book or topic" className={formControlClassName} />
          </label>
          <ActionButton type="submit" variant="secondary"><Search aria-hidden="true" className="h-4 w-4" />Search</ActionButton>
        </form>
      </ContentCard>

      <RoomSection
        title="Rooms I Own or Lead"
        description="Rooms where you can manage studies, overview details, resources, and members."
        rooms={leadRooms}
        emptyTitle="No rooms to lead yet"
        emptyDescription="Rooms you own or lead will appear here."
      />
      <RoomSection
        title="My Rooms"
        description="Study Rooms where you participate as a member or moderator."
        rooms={myRooms}
        emptyTitle="No memberships yet"
        emptyDescription="Join or create a Study Room to begin building your study archive."
      />
      <RoomSection
        title="Discover Public Rooms"
        description="Public Study Rooms available to discover. Private and unlisted rooms are not exposed here."
        rooms={data.discoverRooms}
        emptyTitle="No public rooms found"
        emptyDescription="Try a different search, Bible book, topic, or status filter."
      />

      <nav className="mt-10 flex flex-wrap items-center justify-between gap-3" aria-label="Study Rooms pages">
        <ActionButton
          href={`/study-rooms?q=${encodeURIComponent(q)}&topic=${encodeURIComponent(topic)}&status=${status}&page=${Math.max(1, page - 1)}`}
          variant="secondary"
          size="sm"
          className={hasPreviousPage ? "" : "pointer-events-none bg-[#f7ead7] text-[#67564c]"}
          aria-disabled={!hasPreviousPage}
        >
          Previous
        </ActionButton>
        <p className="text-sm text-[#67564c]">Page {page}</p>
        <ActionButton
          href={`/study-rooms?q=${encodeURIComponent(q)}&topic=${encodeURIComponent(topic)}&status=${status}&page=${page + 1}`}
          variant="secondary"
          size="sm"
          className={hasNextPage ? "" : "pointer-events-none bg-[#f7ead7] text-[#67564c]"}
          aria-disabled={!hasNextPage}
        >
          Next
        </ActionButton>
      </nav>
    </PageContainer>
  );
}
