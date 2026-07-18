import {
  Archive,
  BookMarked,
  BookOpenText,
  CalendarDays,
  FileText,
  LinkIcon,
  MessageSquareText,
  NotebookText,
  Pin,
  Flag,
  Lock,
  Bookmark,
  BookmarkCheck,
  Shield,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import {
  archiveStudyRoom,
  createStudyRoomDiscussionReply,
  createStudyRoomDiscussionThread,
  createStudyRoomNote,
  createStudyRoomPrayerRequest,
  createStudyRoomResource,
  createStudyRoomStudy,
  deleteStudyRoomDiscussionReply,
  deleteStudyRoomDiscussionThread,
  deleteStudyRoomNote,
  deleteStudyRoomPrayerRequest,
  deleteStudyRoomResource,
  inviteStudyRoomMember,
  joinStudyRoom,
  leaveStudyRoom,
  markStudyRoomPrayerAnswered,
  removeStudyRoomMember,
  reportStudyRoomContent,
  reviewStudyRoomJoinRequest,
  transferStudyRoomOwnership,
  toggleStudyRoomBookmark,
  toggleStudyRoomPrayerSupport,
  updateStudyProgress,
  updateStudyRoomDiscussionModeration,
  updateStudyRoomDiscussionReply,
  updateStudyRoomDiscussionThread,
  updateStudyRoomMemberRole,
  updateStudyRoomNote,
  updateStudyRoomPrayerRequest,
  updateStudyRoomResource,
  updateStudyRoomSettings,
  updateStudyRoomStudy,
  type StudyRoomDiscussionReply,
  type StudyRoomDiscussionThread,
  type StudyRoomDetailData,
  type StudyRoomInviteSearchResult,
  type StudyRoomMember,
  type StudyRoomNote,
  type StudyRoomPrayerRequest,
  type StudyRoomResource,
  type StudyRoomStudy,
} from "@/app/actions/study-rooms";
import {
  Badge,
  ConfirmActionPanel,
  ContentCard,
  EmptyState,
  FormActions,
  FormField,
  FormHint,
  FormLabel,
  SectionHeader,
  formControlClassName,
} from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  formatDate,
  formatDateTime,
  formatMembershipMode,
  formatProgressStatus,
  formatRoomStatus,
  formatStudyRoomRole,
  formatStudyStatus,
  formatVisibility,
} from "@/components/study-rooms/study-room-format";

const sectionItems = [
  ["overview", "Overview"],
  ["studies", "Studies"],
  ["notes", "Shared Notes"],
  ["discussion", "Discussion"],
  ["prayer", "Prayer"],
  ["resources", "Resources"],
  ["members", "Members"],
  ["settings", "Settings"],
] as const;

type StudyRoomDetailFilters = {
  notesSort: string;
  prayerStatus: string;
  prayerCategory: string;
  resourceType: string;
  saved: boolean;
};

function fieldId(prefix: string, id: string) {
  return `${prefix}-${id}`;
}

function SectionNav({ roomId, active, canManage }: { roomId: string; active: string; canManage: boolean }) {
  const items = sectionItems.filter(([key]) => canManage || key !== "settings");

  return (
    <nav aria-label="Study Room sections" className="mt-8 overflow-x-auto pb-2">
      <div className="flex min-w-max gap-2">
        {items.map(([key, label]) => (
          <Link
            key={key}
            href={`/study-rooms/${roomId}?section=${key}`}
            aria-current={active === key ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a94720]/15 ${
              active === key ? "bg-[#a94720] text-white" : "border border-[#d9b99d] bg-white/70 text-[#67564c] hover:bg-white"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function JoinControls({ data }: { data: StudyRoomDetailData }) {
  const room = data.room;
  if (!room || data.viewer.isMember || data.viewer.isPlatformEngineer) return null;
  if (room.status !== "active") {
    return <p className="text-sm font-semibold text-[#8a3f1e]">This Study Room is not open for new members.</p>;
  }

  if (room.membership_mode === "open_join") {
    return (
      <form action={joinStudyRoom}>
        <input type="hidden" name="room_id" value={room.id} />
        <SubmitButton pendingLabel="Joining...">Join Study Room</SubmitButton>
      </form>
    );
  }

  if (room.membership_mode === "request_to_join") {
    return (
      <form action={joinStudyRoom} className="space-y-3">
        <input type="hidden" name="room_id" value={room.id} />
        <FormField>
          <FormLabel htmlFor="join-message">Request message</FormLabel>
          <textarea id="join-message" name="message" rows={3} maxLength={1000} className={formControlClassName} />
        </FormField>
        <SubmitButton pendingLabel="Sending request...">Request to Join</SubmitButton>
      </form>
    );
  }

  return <p className="text-sm font-semibold text-[#8a3f1e]">This Study Room is invite only.</p>;
}

function OverviewSection({ data }: { data: StudyRoomDetailData }) {
  const room = data.room;
  if (!room) return null;
  const scripture = room.pinned_scripture_reference || room.current_scripture_reference;
  const recentStudies = data.studies.filter((study) => study.status !== "draft").slice(0, 4);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <ContentCard as="section" className="overflow-hidden p-0">
          {room.cover_image_url ? (
            <div
              aria-hidden="true"
              className="aspect-[16/7] w-full bg-cover bg-center"
              style={{ backgroundImage: `url("${room.cover_image_url.replace(/"/g, "%22")}")` }}
            />
          ) : null}
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap gap-2">
              <Badge tone={room.status === "active" ? "success" : "neutral"}>{formatRoomStatus(room.status)}</Badge>
              <Badge tone="neutral">{formatVisibility(room.visibility)}</Badge>
              <Badge tone="neutral">{formatMembershipMode(room.membership_mode)}</Badge>
              {data.viewer.role ? <Badge>{formatStudyRoomRole(data.viewer.role)}</Badge> : null}
              {data.viewer.isPlatformEngineer ? <Badge tone="solid">Platform access</Badge> : null}
            </div>
            <p className="mt-5 whitespace-pre-line leading-7 text-[#67564c]">{room.description}</p>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {room.study_topic ? <div><dt className="text-sm font-semibold text-[#8a3f1e]">Current Study</dt><dd className="mt-1 font-semibold">{room.study_topic}</dd></div> : null}
              {room.primary_bible_book ? <div><dt className="text-sm font-semibold text-[#8a3f1e]">Primary Bible book</dt><dd className="mt-1 font-semibold">{room.primary_bible_book}</dd></div> : null}
            </dl>
          </div>
        </ContentCard>

        <ContentCard as="section" className="bg-[#fff8f0]">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#9b4d25]">Pinned Scripture</p>
          <p className="mt-3 break-words text-2xl font-semibold sm:text-3xl">{scripture || "No Scripture pinned yet"}</p>
        </ContentCard>

        <ContentCard as="section">
          <SectionHeader title="Current and Next Study" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <StudySummaryCard label="Current Study" study={data.currentStudy} />
            <StudySummaryCard label="Next Study" study={data.nextStudy} />
          </div>
        </ContentCard>

        <ContentCard as="section">
          <SectionHeader title="Recent Studies" description="The newest visible entries in this room&apos;s study archive." />
          {recentStudies.length === 0 ? (
            <EmptyState className="mt-5" icon={BookOpenText} title="No Studies yet" description="Leaders can add the first Study when the room is ready." />
          ) : (
            <div className="mt-5 space-y-3">
              {recentStudies.map((study) => <StudyListItem key={study.id} study={study} canLead={false} roomId={room.id} readOnly />)}
            </div>
          )}
        </ContentCard>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
        <ContentCard as="section">
          <SectionHeader title="Membership" description={`${data.memberSummary.total} ${data.memberSummary.total === 1 ? "member" : "members"}`} />
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <SummaryCount label="Owners" value={data.memberSummary.owners} />
            <SummaryCount label="Leaders" value={data.memberSummary.leaders} />
            <SummaryCount label="Moderators" value={data.memberSummary.moderators} />
            <SummaryCount label="Members" value={data.memberSummary.members} />
          </dl>
          <div className="mt-6">
            <JoinControls data={data} />
          </div>
        </ContentCard>

        <SummaryList title="Recent Shared Notes" items={data.recentNotes.map((note) => `${note.title} - ${note.author_name}`)} icon={NotebookText} />
        <SummaryList title="Recent Prayer Requests" items={data.recentPrayerRequests.map((prayer) => `${prayer.title} - ${prayer.category}`)} icon={BookMarked} />
        <SummaryList title="Recent Discussions" items={data.recentDiscussions.map((thread) => `${thread.title} - ${thread.author_name}`)} icon={MessageSquareText} />
        <SummaryList title="Resources" items={data.resources.map((resource) => resource.title)} icon={LinkIcon} />
      </aside>
    </div>
  );
}

function StudySummaryCard({ label, study }: { label: string; study: StudyRoomStudy | null }) {
  return (
    <div className="rounded-xl border border-[#ead6c5] bg-white/70 p-4">
      <p className="text-sm font-semibold text-[#8a3f1e]">{label}</p>
      {study ? (
        <>
          <h3 className="mt-2 font-semibold">{study.study_number ? `Study ${study.study_number}: ` : ""}{study.title}</h3>
          {study.scripture_reference ? <p className="mt-1 break-words text-sm text-[#67564c]">{study.scripture_reference}</p> : null}
          {study.scheduled_at ? <p className="mt-2 text-sm text-[#67564c]">{formatDateTime(study.scheduled_at)}</p> : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-[#67564c]">No Study selected yet.</p>
      )}
    </div>
  );
}

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#fff4e8] p-3">
      <dt className="text-[#67564c]">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function SummaryList({ title, items, icon: Icon }: { title: string; items: string[]; icon: typeof NotebookText }) {
  return (
    <ContentCard as="section">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden="true" className="h-4 w-4 text-[#b94f22]" />
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-[#67564c]">Nothing to show yet.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[#67564c]">
          {items.slice(0, 4).map((item, index) => <li key={`${item}-${index}`} className="break-words">{item}</li>)}
        </ul>
      )}
    </ContentCard>
  );
}

function StudySelect({ studies, defaultValue = "" }: { studies: StudyRoomStudy[]; defaultValue?: string | null }) {
  return (
    <FormField>
      <FormLabel htmlFor={`study-select-${defaultValue || "new"}`}>Study association</FormLabel>
      <select id={`study-select-${defaultValue || "new"}`} name="study_id" defaultValue={defaultValue || ""} className={formControlClassName}>
        <option value="">Room-level</option>
        {studies.map((study) => (
          <option key={study.id} value={study.id}>
            {study.study_number ? `Study ${study.study_number}: ` : ""}{study.title}
          </option>
        ))}
      </select>
      <FormHint>Leave blank for a room-level item.</FormHint>
    </FormField>
  );
}

function ScopeBadge({
  studyTitle,
  studyNumber,
  roomLabel = "Room Note",
  studyLabel = "Study Note",
}: {
  studyTitle: string | null;
  studyNumber: number | null;
  roomLabel?: string;
  studyLabel?: string;
}) {
  return (
    <Badge tone="neutral">
      {studyTitle ? `${studyLabel}${studyNumber ? ` ${studyNumber}` : ""}: ${studyTitle}` : roomLabel}
    </Badge>
  );
}

function BookmarkButton({
  roomId,
  targetType,
  targetId,
  isBookmarked,
  returnTo,
}: {
  roomId: string;
  targetType: "note" | "thread";
  targetId: string;
  isBookmarked: boolean;
  returnTo: string;
}) {
  return (
    <form action={toggleStudyRoomBookmark}>
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="target_id" value={targetId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <SubmitButton pendingLabel="Saving..." variant="secondary">
        {isBookmarked ? <BookmarkCheck aria-hidden="true" className="h-4 w-4" /> : <Bookmark aria-hidden="true" className="h-4 w-4" />}
        <span>{isBookmarked ? "Saved" : "Save"}</span>
        <span className="sr-only">{isBookmarked ? " privately" : " privately"}</span>
      </SubmitButton>
    </form>
  );
}

function ReportForm({
  roomId,
  targetType,
  targetId,
  returnTo,
}: {
  roomId: string;
  targetType: "note" | "thread" | "reply" | "prayer" | "resource";
  targetId: string;
  returnTo: string;
}) {
  return (
    <details className="rounded-xl border border-[#ead6c5] bg-[#fff8f0] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#8a3f1e]">
        <Flag aria-hidden="true" className="mr-1 inline h-4 w-4" />
        Report
      </summary>
      <form action={reportStudyRoomContent} className="mt-4 space-y-3">
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="target_type" value={targetType} />
        <input type="hidden" name="target_id" value={targetId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <FormField>
          <FormLabel htmlFor={`report-reason-${targetType}-${targetId}`} required>Reason</FormLabel>
          <input id={`report-reason-${targetType}-${targetId}`} name="reason" required maxLength={160} className={formControlClassName} />
        </FormField>
        <FormField>
          <FormLabel htmlFor={`report-details-${targetType}-${targetId}`}>Details</FormLabel>
          <textarea id={`report-details-${targetType}-${targetId}`} name="details" rows={3} maxLength={1000} className={formControlClassName} />
        </FormField>
        <SubmitButton pendingLabel="Reporting..." variant="secondary">Submit report</SubmitButton>
      </form>
    </details>
  );
}

function ItemMeta({ author, createdAt, updatedAt }: { author: string; createdAt: string; updatedAt: string }) {
  return (
    <p className="mt-2 text-sm text-[#67564c]">
      {author} - Created {formatDateTime(createdAt)}{updatedAt !== createdAt ? ` - Edited ${formatDateTime(updatedAt)}` : ""}
    </p>
  );
}

function StudiesSection({ data }: { data: StudyRoomDetailData }) {
  const room = data.room;
  if (!room) return null;
  const archived = room.status === "archived";

  return (
    <div className="space-y-6">
      <ContentCard as="section">
        <SectionHeader
          title="Studies"
          description="A structured timeline for this room's Bible study archive."
        />
        {data.studies.length === 0 ? (
          <EmptyState className="mt-5" icon={BookOpenText} title="No Studies yet" description="Owners and Leaders can add the first Study." />
        ) : (
          <div className="mt-5 space-y-4">
            {data.studies.map((study) => (
              <StudyListItem
                key={study.id}
                study={study}
                roomId={room.id}
                canLead={data.viewer.canLead && !archived}
                readOnly={archived}
              />
            ))}
          </div>
        )}
      </ContentCard>

      {data.viewer.canLead && !archived ? <StudyForm roomId={room.id} /> : null}
    </div>
  );
}

function NotesSection({ data, filters }: { data: StudyRoomDetailData; filters: StudyRoomDetailFilters }) {
  const room = data.room;
  if (!room) return null;
  const archived = room.status === "archived";
  const returnTo = `/study-rooms/${room.id}?section=notes`;
  const notes = (filters.saved ? data.savedNotes : data.notes).toSorted((a, b) => {
    if (filters.notesSort === "oldest") return a.created_at.localeCompare(b.created_at);
    if (filters.notesSort === "study") return (a.study_number || 9999) - (b.study_number || 9999) || b.updated_at.localeCompare(a.updated_at);
    return b.updated_at.localeCompare(a.updated_at);
  });

  return (
    <div className="space-y-6">
      <ContentCard as="section">
        <SectionHeader title="Shared Notes" description="Room and Study notes shared with this Study Room." />
        <form className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <input type="hidden" name="section" value="notes" />
          <FormField>
            <FormLabel htmlFor="notes-sort">Sort notes</FormLabel>
            <select id="notes-sort" name="notes_sort" defaultValue={filters.notesSort} className={formControlClassName}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="study">Study order</option>
            </select>
          </FormField>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#3b312b]">
            <input type="checkbox" name="saved" value="1" defaultChecked={filters.saved} className="h-4 w-4" />
            Saved only
          </label>
          <SubmitButton pendingLabel="Filtering..." variant="secondary">Apply</SubmitButton>
        </form>
        {notes.length === 0 ? (
          <EmptyState className="mt-5" icon={NotebookText} title="No notes to show" description="Shared room and Study notes will appear here." />
        ) : (
          <div className="mt-5 space-y-4">
            {notes.map((note) => <NoteItem key={note.id} note={note} roomId={room.id} studies={data.studies} archived={archived} returnTo={returnTo} />)}
          </div>
        )}
      </ContentCard>
      {data.viewer.isMember && !archived ? <NoteForm roomId={room.id} studies={data.studies} returnTo={returnTo} /> : null}
    </div>
  );
}

function NoteForm({ roomId, studies, note, returnTo }: { roomId: string; studies: StudyRoomStudy[]; note?: StudyRoomNote; returnTo: string }) {
  return (
    <ContentCard as="section">
      <SectionHeader title={note ? "Edit Note" : "Create Note"} />
      <form action={note ? updateStudyRoomNote : createStudyRoomNote} className="mt-5 space-y-5">
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="return_to" value={returnTo} />
        {note ? <input type="hidden" name="note_id" value={note.id} /> : null}
        <StudySelect studies={studies} defaultValue={note?.study_id || ""} />
        <FormField>
          <FormLabel htmlFor={`note-title-${note?.id || "new"}`} required>Title</FormLabel>
          <input id={`note-title-${note?.id || "new"}`} name="title" required maxLength={160} defaultValue={note?.title || ""} className={formControlClassName} />
        </FormField>
        <FormField>
          <FormLabel htmlFor={`note-scripture-${note?.id || "new"}`}>Scripture reference</FormLabel>
          <input id={`note-scripture-${note?.id || "new"}`} name="scripture_reference" maxLength={160} defaultValue={note?.scripture_reference || ""} className={formControlClassName} />
        </FormField>
        <FormField>
          <FormLabel htmlFor={`note-body-${note?.id || "new"}`} required>Body</FormLabel>
          <textarea id={`note-body-${note?.id || "new"}`} name="body" required rows={6} maxLength={20000} defaultValue={note?.body || ""} className={formControlClassName} />
        </FormField>
        <SubmitButton pendingLabel="Saving...">{note ? "Save Note" : "Create Note"}</SubmitButton>
      </form>
    </ContentCard>
  );
}

function NoteItem({ note, roomId, studies, archived, returnTo }: { note: StudyRoomNote; roomId: string; studies: StudyRoomStudy[]; archived: boolean; returnTo: string }) {
  return (
    <article id={`note-${note.id}`} className="rounded-xl border border-[#ead6c5] bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2"><ScopeBadge studyTitle={note.study_title} studyNumber={note.study_number} /></div>
          <h3 className="mt-3 break-words text-lg font-semibold">{note.title}</h3>
          <ItemMeta author={note.author_name} createdAt={note.created_at} updatedAt={note.updated_at} />
        </div>
        <BookmarkButton roomId={roomId} targetType="note" targetId={note.id} isBookmarked={note.is_bookmarked} returnTo={returnTo} />
      </div>
      {note.scripture_reference ? <p className="mt-3 break-words text-sm font-semibold text-[#8a3f1e]">{note.scripture_reference}</p> : null}
      <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-[#67564c]">{note.body}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {!archived && note.canEdit ? (
          <details className="rounded-xl border border-[#ead6c5] bg-[#fff8f0] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#8a3f1e]">Edit note</summary>
            <div className="mt-4"><NoteForm roomId={roomId} studies={studies} note={note} returnTo={returnTo} /></div>
            <form action={deleteStudyRoomNote} className="mt-4">
              <input type="hidden" name="room_id" value={roomId} />
              <input type="hidden" name="note_id" value={note.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <SubmitButton pendingLabel="Removing..." variant="danger">Remove note</SubmitButton>
            </form>
          </details>
        ) : null}
        <ReportForm roomId={roomId} targetType="note" targetId={note.id} returnTo={returnTo} />
      </div>
    </article>
  );
}

function DiscussionsSection({ data, filters }: { data: StudyRoomDetailData; filters: StudyRoomDetailFilters }) {
  const room = data.room;
  if (!room) return null;
  const archived = room.status === "archived";
  const returnTo = `/study-rooms/${room.id}?section=discussion`;
  const threads = filters.saved ? data.savedThreads : data.discussionThreads;

  return (
    <div className="space-y-6">
      <ContentCard as="section">
        <SectionHeader title="Discussion" description="Structured threads for Study Room conversation. This is not real-time chat." />
        <form className="mt-5">
          <input type="hidden" name="section" value="discussion" />
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#3b312b]">
            <input type="checkbox" name="saved" value="1" defaultChecked={filters.saved} className="h-4 w-4" />
            Saved threads only
          </label>
          <SubmitButton pendingLabel="Filtering..." variant="secondary">Apply</SubmitButton>
        </form>
        {threads.length === 0 ? (
          <EmptyState className="mt-5" icon={MessageSquareText} title="No discussions yet" description="Room members can start the first structured discussion." />
        ) : (
          <div className="mt-5 space-y-4">
            {threads.map((thread) => <ThreadItem key={thread.id} thread={thread} roomId={room.id} studies={data.studies} archived={archived} canModerate={data.viewer.canModerate} returnTo={returnTo} />)}
          </div>
        )}
      </ContentCard>
      {data.viewer.isMember && !archived ? <ThreadForm roomId={room.id} studies={data.studies} returnTo={returnTo} /> : null}
    </div>
  );
}

function ThreadForm({ roomId, studies, thread, returnTo }: { roomId: string; studies: StudyRoomStudy[]; thread?: StudyRoomDiscussionThread; returnTo: string }) {
  return (
    <ContentCard as="section">
      <SectionHeader title={thread ? "Edit Discussion" : "Create Discussion"} />
      <form action={thread ? updateStudyRoomDiscussionThread : createStudyRoomDiscussionThread} className="mt-5 space-y-5">
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="return_to" value={returnTo} />
        {thread ? <input type="hidden" name="thread_id" value={thread.id} /> : null}
        <StudySelect studies={studies} defaultValue={thread?.study_id || ""} />
        <FormField>
          <FormLabel htmlFor={`thread-title-${thread?.id || "new"}`} required>Title</FormLabel>
          <input id={`thread-title-${thread?.id || "new"}`} name="title" required maxLength={160} defaultValue={thread?.title || ""} className={formControlClassName} />
        </FormField>
        <FormField>
          <FormLabel htmlFor={`thread-body-${thread?.id || "new"}`} required>Body</FormLabel>
          <textarea id={`thread-body-${thread?.id || "new"}`} name="body" required rows={6} maxLength={20000} defaultValue={thread?.body || ""} className={formControlClassName} />
        </FormField>
        <SubmitButton pendingLabel="Saving...">{thread ? "Save Discussion" : "Start Discussion"}</SubmitButton>
      </form>
    </ContentCard>
  );
}

function ThreadItem({
  thread,
  roomId,
  studies,
  archived,
  canModerate,
  returnTo,
}: {
  thread: StudyRoomDiscussionThread;
  roomId: string;
  studies: StudyRoomStudy[];
  archived: boolean;
  canModerate: boolean;
  returnTo: string;
}) {
  return (
    <article id={`thread-${thread.id}`} className="rounded-xl border border-[#ead6c5] bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <ScopeBadge studyTitle={thread.study_title} studyNumber={thread.study_number} roomLabel="Room Discussion" studyLabel="Study Discussion" />
            {thread.is_pinned ? <Badge tone="solid"><Pin aria-hidden="true" className="h-3 w-3" />Pinned</Badge> : null}
            {thread.is_locked ? <Badge tone="neutral"><Lock aria-hidden="true" className="h-3 w-3" />Locked</Badge> : null}
          </div>
          <h3 className="mt-3 break-words text-lg font-semibold">{thread.title}</h3>
          <ItemMeta author={thread.author_name} createdAt={thread.created_at} updatedAt={thread.updated_at} />
        </div>
        <BookmarkButton roomId={roomId} targetType="thread" targetId={thread.id} isBookmarked={thread.is_bookmarked} returnTo={returnTo} />
      </div>
      <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-[#67564c]">{thread.body}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {!archived && thread.canEdit ? (
          <details className="rounded-xl border border-[#ead6c5] bg-[#fff8f0] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#8a3f1e]">Edit discussion</summary>
            <div className="mt-4"><ThreadForm roomId={roomId} studies={studies} thread={thread} returnTo={returnTo} /></div>
            <form action={deleteStudyRoomDiscussionThread} className="mt-4">
              <input type="hidden" name="room_id" value={roomId} />
              <input type="hidden" name="thread_id" value={thread.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <SubmitButton pendingLabel="Removing..." variant="danger">Remove discussion</SubmitButton>
            </form>
          </details>
        ) : null}
        {!archived && canModerate ? (
          <details className="rounded-xl border border-[#ead6c5] bg-[#fff8f0] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#8a3f1e]">Moderation</summary>
            <form action={updateStudyRoomDiscussionModeration} className="mt-4 space-y-3">
              <input type="hidden" name="room_id" value={roomId} />
              <input type="hidden" name="thread_id" value={thread.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="is_pinned" defaultChecked={thread.is_pinned} />Pinned</label>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="is_locked" defaultChecked={thread.is_locked} />Locked</label>
              <SubmitButton pendingLabel="Saving..." variant="secondary">Save moderation</SubmitButton>
            </form>
          </details>
        ) : null}
        <ReportForm roomId={roomId} targetType="thread" targetId={thread.id} returnTo={returnTo} />
      </div>
      <div className="mt-6 space-y-3">
        <h4 className="font-semibold">Replies</h4>
        {thread.replies.length === 0 ? <p className="text-sm text-[#67564c]">No replies yet.</p> : null}
        {thread.replies.map((reply) => <ReplyItem key={reply.id} reply={reply} roomId={roomId} archived={archived} returnTo={returnTo} />)}
        {thread.is_locked ? <p className="text-sm font-semibold text-[#8a3f1e]">This discussion is locked and no longer accepts replies.</p> : null}
        {!archived && !thread.is_locked ? (
          <form action={createStudyRoomDiscussionReply} className="space-y-3">
            <input type="hidden" name="room_id" value={roomId} />
            <input type="hidden" name="thread_id" value={thread.id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <FormField>
              <FormLabel htmlFor={`reply-body-${thread.id}`} required>Reply</FormLabel>
              <textarea id={`reply-body-${thread.id}`} name="body" required rows={3} maxLength={20000} className={formControlClassName} />
            </FormField>
            <SubmitButton pendingLabel="Posting..." variant="secondary">Post Reply</SubmitButton>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function ReplyItem({ reply, roomId, archived, returnTo }: { reply: StudyRoomDiscussionReply; roomId: string; archived: boolean; returnTo: string }) {
  return (
    <article id={`reply-${reply.id}`} className="rounded-xl border border-[#ead6c5] bg-[#fff8f0] p-4">
      <ItemMeta author={reply.author_name} createdAt={reply.created_at} updatedAt={reply.updated_at} />
      <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-[#67564c]">{reply.body}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {!archived && reply.canEdit ? (
          <details className="rounded-xl border border-[#ead6c5] bg-white/80 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#8a3f1e]">Edit reply</summary>
            <form action={updateStudyRoomDiscussionReply} className="mt-4 space-y-3">
              <input type="hidden" name="room_id" value={roomId} />
              <input type="hidden" name="reply_id" value={reply.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <FormField>
                <FormLabel htmlFor={`edit-reply-${reply.id}`} required>Reply body</FormLabel>
                <textarea id={`edit-reply-${reply.id}`} name="body" required rows={3} defaultValue={reply.body} className={formControlClassName} />
              </FormField>
              <SubmitButton pendingLabel="Saving..." variant="secondary">Save Reply</SubmitButton>
            </form>
            <form action={deleteStudyRoomDiscussionReply} className="mt-4">
              <input type="hidden" name="room_id" value={roomId} />
              <input type="hidden" name="reply_id" value={reply.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <SubmitButton pendingLabel="Removing..." variant="danger">Remove reply</SubmitButton>
            </form>
          </details>
        ) : null}
        <ReportForm roomId={roomId} targetType="reply" targetId={reply.id} returnTo={returnTo} />
      </div>
    </article>
  );
}

function PrayerSection({ data, filters }: { data: StudyRoomDetailData; filters: StudyRoomDetailFilters }) {
  const room = data.room;
  if (!room) return null;
  const archived = room.status === "archived";
  const returnTo = `/study-rooms/${room.id}?section=prayer`;
  const prayers = data.prayerRequests.filter((prayer) =>
    (filters.prayerStatus === "all" || prayer.status === filters.prayerStatus) &&
    (filters.prayerCategory === "all" || prayer.category === filters.prayerCategory)
  );

  return (
    <div className="space-y-6">
      <ContentCard as="section">
        <SectionHeader title="Prayer" description="Room-scoped prayer requests stay inside this Study Room." />
        <form className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <input type="hidden" name="section" value="prayer" />
          <FormField>
            <FormLabel htmlFor="prayer-status">Status</FormLabel>
            <select id="prayer-status" name="prayer_status" defaultValue={filters.prayerStatus} className={formControlClassName}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="answered">Answered</option>
            </select>
          </FormField>
          <FormField>
            <FormLabel htmlFor="prayer-category">Category</FormLabel>
            <select id="prayer-category" name="prayer_category" defaultValue={filters.prayerCategory} className={formControlClassName}>
              <option value="all">All categories</option>
              <option value="praise">Praise</option>
              <option value="healing">Healing</option>
              <option value="family">Family</option>
              <option value="church">Church</option>
              <option value="work">Work</option>
              <option value="salvation">Salvation</option>
              <option value="other">Other</option>
            </select>
          </FormField>
          <SubmitButton pendingLabel="Filtering..." variant="secondary">Apply</SubmitButton>
        </form>
        {prayers.length === 0 ? (
          <EmptyState className="mt-5" icon={BookMarked} title="No prayer requests" description="Room prayer requests and answered updates will appear here." />
        ) : (
          <div className="mt-5 space-y-4">
            {prayers.map((prayer) => <PrayerItem key={prayer.id} prayer={prayer} roomId={room.id} studies={data.studies} archived={archived} returnTo={returnTo} />)}
          </div>
        )}
      </ContentCard>
      {data.viewer.isMember && !archived ? <PrayerForm roomId={room.id} studies={data.studies} returnTo={returnTo} /> : null}
    </div>
  );
}

function PrayerForm({ roomId, studies, prayer, returnTo }: { roomId: string; studies: StudyRoomStudy[]; prayer?: StudyRoomPrayerRequest; returnTo: string }) {
  return (
    <ContentCard as="section">
      <SectionHeader title={prayer ? "Edit Prayer Request" : "Create Prayer Request"} />
      <form action={prayer ? updateStudyRoomPrayerRequest : createStudyRoomPrayerRequest} className="mt-5 space-y-5">
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="return_to" value={returnTo} />
        {prayer ? <input type="hidden" name="prayer_id" value={prayer.id} /> : null}
        <StudySelect studies={studies} defaultValue={prayer?.study_id || ""} />
        <FormField>
          <FormLabel htmlFor={`prayer-title-${prayer?.id || "new"}`} required>Title</FormLabel>
          <input id={`prayer-title-${prayer?.id || "new"}`} name="title" required maxLength={160} defaultValue={prayer?.title || ""} className={formControlClassName} />
        </FormField>
        <FormField>
          <FormLabel htmlFor={`prayer-category-${prayer?.id || "new"}`}>Category</FormLabel>
          <select id={`prayer-category-${prayer?.id || "new"}`} name="category" defaultValue={prayer?.category || "other"} className={formControlClassName}>
            <option value="praise">Praise</option>
            <option value="healing">Healing</option>
            <option value="family">Family</option>
            <option value="church">Church</option>
            <option value="work">Work</option>
            <option value="salvation">Salvation</option>
            <option value="other">Other</option>
          </select>
        </FormField>
        <FormField>
          <FormLabel htmlFor={`prayer-body-${prayer?.id || "new"}`} required>Body</FormLabel>
          <textarea id={`prayer-body-${prayer?.id || "new"}`} name="body" required rows={5} maxLength={10000} defaultValue={prayer?.body || ""} className={formControlClassName} />
        </FormField>
        <SubmitButton pendingLabel="Saving...">{prayer ? "Save Prayer Request" : "Share Prayer Request"}</SubmitButton>
      </form>
    </ContentCard>
  );
}

function PrayerItem({ prayer, roomId, studies, archived, returnTo }: { prayer: StudyRoomPrayerRequest; roomId: string; studies: StudyRoomStudy[]; archived: boolean; returnTo: string }) {
  return (
    <article id={`prayer-${prayer.id}`} className="rounded-xl border border-[#ead6c5] bg-white/70 p-4">
      <div className="flex flex-wrap gap-2">
        <Badge tone={prayer.status === "answered" ? "success" : "neutral"}>{prayer.status === "answered" ? "Answered" : "Active"}</Badge>
        <Badge tone="neutral">{prayer.category}</Badge>
        <ScopeBadge studyTitle={prayer.study_title} studyNumber={prayer.study_number} roomLabel="Room Prayer" studyLabel="Study Prayer" />
      </div>
      <h3 className="mt-3 break-words text-lg font-semibold">{prayer.title}</h3>
      <ItemMeta author={prayer.author_name} createdAt={prayer.created_at} updatedAt={prayer.updated_at} />
      <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-[#67564c]">{prayer.body}</p>
      {prayer.answered_update ? <p className="mt-3 rounded-xl bg-[#eef7ee] p-3 text-sm leading-6 text-[#386641]">Answered update: {prayer.answered_update}</p> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        {!archived ? (
          <form action={toggleStudyRoomPrayerSupport}>
            <input type="hidden" name="room_id" value={roomId} />
            <input type="hidden" name="prayer_id" value={prayer.id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <SubmitButton pendingLabel="Saving..." variant="secondary">{prayer.viewer_supports ? "Praying" : "I'm praying"} ({prayer.support_count})</SubmitButton>
          </form>
        ) : null}
        {!archived && prayer.canEdit && prayer.status !== "answered" ? (
          <details className="rounded-xl border border-[#ead6c5] bg-[#fff8f0] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#8a3f1e]">Mark answered</summary>
            <form action={markStudyRoomPrayerAnswered} className="mt-4 space-y-3">
              <input type="hidden" name="room_id" value={roomId} />
              <input type="hidden" name="prayer_id" value={prayer.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <FormField>
                <FormLabel htmlFor={`answered-update-${prayer.id}`}>Answered-prayer update</FormLabel>
                <textarea id={`answered-update-${prayer.id}`} name="answered_update" rows={3} maxLength={10000} className={formControlClassName} />
              </FormField>
              <SubmitButton pendingLabel="Saving..." variant="secondary">Mark answered</SubmitButton>
            </form>
          </details>
        ) : null}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {!archived && prayer.canEdit ? (
          <details className="rounded-xl border border-[#ead6c5] bg-[#fff8f0] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#8a3f1e]">Edit prayer request</summary>
            <div className="mt-4"><PrayerForm roomId={roomId} studies={studies} prayer={prayer} returnTo={returnTo} /></div>
            <form action={deleteStudyRoomPrayerRequest} className="mt-4">
              <input type="hidden" name="room_id" value={roomId} />
              <input type="hidden" name="prayer_id" value={prayer.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <SubmitButton pendingLabel="Removing..." variant="danger">Remove prayer request</SubmitButton>
            </form>
          </details>
        ) : null}
        <ReportForm roomId={roomId} targetType="prayer" targetId={prayer.id} returnTo={returnTo} />
      </div>
    </article>
  );
}

function ResourcesSection({ data, filters }: { data: StudyRoomDetailData; filters: StudyRoomDetailFilters }) {
  const room = data.room;
  if (!room) return null;
  const archived = room.status === "archived";
  const returnTo = `/study-rooms/${room.id}?section=resources`;
  const resources = data.resourcesDetail.filter((resource) => filters.resourceType === "all" || resource.resource_type === filters.resourceType);

  return (
    <div className="space-y-6">
      <ContentCard as="section">
        <SectionHeader title="Resources" description="External links and study aids shared by room leaders." />
        <form className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <input type="hidden" name="section" value="resources" />
          <FormField>
            <FormLabel htmlFor="resource-filter">Resource type</FormLabel>
            <select id="resource-filter" name="resource_type" defaultValue={filters.resourceType} className={formControlClassName}>
              <option value="all">All types</option>
              <option value="article">Article</option>
              <option value="video">Video</option>
              <option value="study_guide">Study Guide</option>
              <option value="pdf">PDF</option>
              <option value="external_link">External Link</option>
              <option value="other">Other</option>
            </select>
          </FormField>
          <SubmitButton pendingLabel="Filtering..." variant="secondary">Apply</SubmitButton>
        </form>
        {resources.length === 0 ? (
          <EmptyState className="mt-5" icon={FileText} title="No resources yet" description="Room leaders can add external resources for this room or a specific Study." />
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {resources.map((resource) => <ResourceItem key={resource.id} resource={resource} roomId={room.id} studies={data.studies} archived={archived} returnTo={returnTo} />)}
          </div>
        )}
      </ContentCard>
      {data.viewer.canLead && !archived ? <ResourceForm roomId={room.id} studies={data.studies} returnTo={returnTo} /> : null}
    </div>
  );
}

function ResourceForm({ roomId, studies, resource, returnTo }: { roomId: string; studies: StudyRoomStudy[]; resource?: StudyRoomResource; returnTo: string }) {
  return (
    <ContentCard as="section">
      <SectionHeader title={resource ? "Edit Resource" : "Add Resource"} />
      <form action={resource ? updateStudyRoomResource : createStudyRoomResource} className="mt-5 space-y-5">
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="return_to" value={returnTo} />
        {resource ? <input type="hidden" name="resource_id" value={resource.id} /> : null}
        <StudySelect studies={studies} defaultValue={resource?.study_id || ""} />
        <FormField>
          <FormLabel htmlFor={`resource-title-${resource?.id || "new"}`} required>Title</FormLabel>
          <input id={`resource-title-${resource?.id || "new"}`} name="title" required maxLength={160} defaultValue={resource?.title || ""} className={formControlClassName} />
        </FormField>
        <FormField>
          <FormLabel htmlFor={`resource-type-${resource?.id || "new"}`}>Resource category</FormLabel>
          <select id={`resource-type-${resource?.id || "new"}`} name="resource_type" defaultValue={resource?.resource_type || "external_link"} className={formControlClassName}>
            <option value="article">Article</option>
            <option value="video">Video</option>
            <option value="study_guide">Study Guide</option>
            <option value="pdf">PDF</option>
            <option value="external_link">External Link</option>
            <option value="other">Other</option>
          </select>
        </FormField>
        <FormField>
          <FormLabel htmlFor={`resource-url-${resource?.id || "new"}`} required>External URL</FormLabel>
          <input id={`resource-url-${resource?.id || "new"}`} name="external_url" type="url" required maxLength={2048} defaultValue={resource?.external_url || ""} className={formControlClassName} />
        </FormField>
        <FormField>
          <FormLabel htmlFor={`resource-description-${resource?.id || "new"}`}>Description</FormLabel>
          <textarea id={`resource-description-${resource?.id || "new"}`} name="description" rows={4} maxLength={5000} defaultValue={resource?.description || ""} className={formControlClassName} />
        </FormField>
        <SubmitButton pendingLabel="Saving...">{resource ? "Save Resource" : "Add Resource"}</SubmitButton>
      </form>
    </ContentCard>
  );
}

function ResourceItem({ resource, roomId, studies, archived, returnTo }: { resource: StudyRoomResource; roomId: string; studies: StudyRoomStudy[]; archived: boolean; returnTo: string }) {
  return (
    <article id={`resource-${resource.id}`} className="rounded-xl border border-[#ead6c5] bg-white/70 p-4">
      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{resource.resource_type.replace(/_/g, " ")}</Badge>
        <ScopeBadge studyTitle={resource.study_title} studyNumber={resource.study_number} roomLabel="Room Resource" studyLabel="Study Resource" />
      </div>
      <h3 className="mt-3 break-words text-lg font-semibold">{resource.title}</h3>
      <p className="mt-2 text-sm text-[#67564c]">Added by {resource.creator_name} - {formatDateTime(resource.updated_at)}</p>
      {resource.description ? <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-[#67564c]">{resource.description}</p> : null}
      <a href={resource.external_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-4 inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-[#2f2722]/20 bg-white/80 px-4 py-2 text-sm font-semibold text-[#2f2722] hover:bg-white">
        <LinkIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="truncate">Open external resource</span>
      </a>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {!archived && (resource.canEdit || resource.canModerate) ? (
          <details className="rounded-xl border border-[#ead6c5] bg-[#fff8f0] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#8a3f1e]">{resource.canEdit ? "Edit resource" : "Moderate resource"}</summary>
            {resource.canEdit ? <div className="mt-4"><ResourceForm roomId={roomId} studies={studies} resource={resource} returnTo={returnTo} /></div> : null}
            <form action={deleteStudyRoomResource} className="mt-4">
              <input type="hidden" name="room_id" value={roomId} />
              <input type="hidden" name="resource_id" value={resource.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <SubmitButton pendingLabel="Removing..." variant="danger">Remove resource</SubmitButton>
            </form>
          </details>
        ) : null}
        <ReportForm roomId={roomId} targetType="resource" targetId={resource.id} returnTo={returnTo} />
      </div>
    </article>
  );
}

function StudyListItem({
  study,
  roomId,
  canLead,
  readOnly = false,
}: {
  study: StudyRoomStudy;
  roomId: string;
  canLead: boolean;
  readOnly?: boolean;
}) {
  const scheduled = formatDateTime(study.scheduled_at);

  return (
    <article className="rounded-xl border border-[#ead6c5] bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold">{study.study_number ? `Study ${study.study_number}: ` : ""}{study.title}</h3>
          {study.scripture_reference ? <p className="mt-1 break-words text-sm font-semibold text-[#8a3f1e]">{study.scripture_reference}</p> : null}
        </div>
        <Badge tone={study.status === "active" ? "success" : "neutral"}>{formatStudyStatus(study.status)}</Badge>
      </div>
      {study.description ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#67564c]">{study.description}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2 text-sm text-[#67564c]">
        {scheduled ? <Badge tone="neutral"><CalendarDays aria-hidden="true" className="h-3 w-3" />{scheduled}</Badge> : null}
        <Badge tone="neutral">Your progress: {formatProgressStatus(study.viewer_progress)}</Badge>
        {study.completed_count !== null ? <Badge tone="neutral">{study.completed_count} completed</Badge> : null}
      </div>
      {!readOnly ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <form action={updateStudyProgress} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="room_id" value={roomId} />
            <input type="hidden" name="study_id" value={study.id} />
            <FormField className="flex-1">
              <FormLabel htmlFor={fieldId("progress", study.id)}>Progress</FormLabel>
              <select id={fieldId("progress", study.id)} name="status" defaultValue={study.viewer_progress} className={formControlClassName}>
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </FormField>
            <SubmitButton pendingLabel="Updating..." variant="secondary">Update</SubmitButton>
          </form>
          {canLead ? <StudyEditForm roomId={roomId} study={study} /> : null}
        </div>
      ) : null}
    </article>
  );
}

function StudyForm({ roomId }: { roomId: string }) {
  return (
    <ContentCard as="section">
      <SectionHeader title="Create Study" description="Add the next ordered Study to this room." />
      <form action={createStudyRoomStudy} className="mt-5 space-y-5">
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="return_to" value={`/study-rooms/${roomId}?section=studies`} />
        <StudyFields prefix="new-study" />
        <FormActions>
          <SubmitButton pendingLabel="Adding Study...">Add Study</SubmitButton>
        </FormActions>
      </form>
    </ContentCard>
  );
}

function StudyEditForm({ roomId, study }: { roomId: string; study: StudyRoomStudy }) {
  return (
    <details className="rounded-xl border border-[#ead6c5] bg-[#fff8f0] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#8a3f1e]">Edit Study</summary>
      <form action={updateStudyRoomStudy} className="mt-4 space-y-4">
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="study_id" value={study.id} />
        <input type="hidden" name="return_to" value={`/study-rooms/${roomId}?section=studies`} />
        <StudyFields prefix={`edit-${study.id}`} study={study} compact />
        <SubmitButton pendingLabel="Saving..." variant="secondary">Save Study</SubmitButton>
      </form>
    </details>
  );
}

function StudyFields({ prefix, study, compact = false }: { prefix: string; study?: StudyRoomStudy; compact?: boolean }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField>
          <FormLabel htmlFor={`${prefix}-title`} required>Study title</FormLabel>
          <input id={`${prefix}-title`} name="title" required maxLength={160} defaultValue={study?.title || ""} className={formControlClassName} />
        </FormField>
        {!study ? (
          <FormField>
            <FormLabel htmlFor={`${prefix}-number`}>Study number</FormLabel>
            <input id={`${prefix}-number`} name="study_number" type="number" min={1} className={formControlClassName} />
          </FormField>
        ) : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField>
          <FormLabel htmlFor={`${prefix}-scripture`}>Scripture reference</FormLabel>
          <input id={`${prefix}-scripture`} name="scripture_reference" maxLength={160} defaultValue={study?.scripture_reference || ""} className={formControlClassName} />
        </FormField>
        <FormField>
          <FormLabel htmlFor={`${prefix}-status`}>Status</FormLabel>
          <select id={`${prefix}-status`} name="status" defaultValue={study?.status || "draft"} className={formControlClassName}>
            <option value="draft">Draft</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </FormField>
      </div>
      {!compact ? (
        <FormField>
          <FormLabel htmlFor={`${prefix}-scheduled`}>Scheduled date and time</FormLabel>
          <input id={`${prefix}-scheduled`} name="scheduled_at" type="datetime-local" className={formControlClassName} />
        </FormField>
      ) : null}
      <FormField>
        <FormLabel htmlFor={`${prefix}-description`}>Objective or description</FormLabel>
        <textarea id={`${prefix}-description`} name="description" rows={compact ? 3 : 4} defaultValue={study?.description || ""} className={formControlClassName} />
      </FormField>
      <FormField>
        <FormLabel htmlFor={`${prefix}-leader-notes`}>Leader notes</FormLabel>
        <textarea id={`${prefix}-leader-notes`} name="leader_notes" rows={compact ? 2 : 3} defaultValue={study?.leader_notes || ""} className={formControlClassName} />
      </FormField>
    </div>
  );
}

function MembersSection({
  data,
  inviteQuery,
  inviteResults,
}: {
  data: StudyRoomDetailData;
  inviteQuery: string;
  inviteResults: StudyRoomInviteSearchResult[];
}) {
  const room = data.room;
  if (!room) return null;
  const canManageRoles = data.viewer.canManage && room.status !== "archived";
  const canInvite = data.viewer.canLead && room.status !== "archived";

  return (
    <div className="space-y-6">
      <ContentCard as="section">
        <SectionHeader title="Members" description="Room roles are displayed clearly for study leadership and participation." />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {data.members.map((member) => (
            <MemberCard key={member.id} member={member} roomId={room.id} canManageRoles={canManageRoles} currentViewerRole={data.viewer.role} />
          ))}
        </div>
      </ContentCard>

      {canInvite ? <InvitationPanel data={data} inviteQuery={inviteQuery} inviteResults={inviteResults} /> : null}
      {canInvite ? <JoinRequestsPanel data={data} /> : null}
      {data.viewer.isMember && data.viewer.role !== "owner" && room.status !== "archived" ? (
        <ConfirmActionPanel
          action={leaveStudyRoom}
          hiddenFields={{ room_id: room.id }}
          title="Leave this Study Room"
          description="Your membership, progress, and private room state will be removed. Shared content remains according to account and content rules."
          actionLabel="Leave Study Room"
          confirmationValue="DELETE"
          confirmationId="leave-study-room"
          className="max-w-3xl"
        />
      ) : null}
    </div>
  );
}

function MemberCard({
  member,
  roomId,
  canManageRoles,
  currentViewerRole,
}: {
  member: StudyRoomMember;
  roomId: string;
  canManageRoles: boolean;
  currentViewerRole: string | null;
}) {
  const initials = member.display_name === "Deleted user" ? "DU" : member.display_name.slice(0, 2).toUpperCase();
  const canEdit = canManageRoles && member.role !== "owner";

  return (
    <article className="rounded-xl border border-[#ead6c5] bg-white/70 p-4">
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#ffe2cb] text-sm font-bold text-[#8a3f1e]">
          {member.avatar_url ? (
            <span
              aria-hidden="true"
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url("${member.avatar_url.replace(/"/g, "%22")}")` }}
            />
          ) : initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-semibold">{member.display_name}</h3>
            <Badge tone={member.role === "owner" ? "solid" : member.role === "leader" ? "ember" : "neutral"}>{formatStudyRoomRole(member.role)}</Badge>
          </div>
          {member.username ? <p className="mt-1 break-words text-sm text-[#67564c]">@{member.username}</p> : null}
          <p className="mt-1 text-sm text-[#67564c]">Joined {formatDate(member.created_at)}</p>
        </div>
      </div>
      {canEdit ? (
        <div className="mt-5 space-y-4">
          <form action={updateStudyRoomMemberRole} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="room_id" value={roomId} />
            <input type="hidden" name="membership_id" value={member.id} />
            <FormField className="flex-1">
              <FormLabel htmlFor={fieldId("role", member.id)}>Role</FormLabel>
              <select id={fieldId("role", member.id)} name="role" defaultValue={member.role} className={formControlClassName}>
                <option value="leader">Leader</option>
                <option value="moderator">Moderator</option>
                <option value="member">Member</option>
              </select>
            </FormField>
            <SubmitButton pendingLabel="Saving..." variant="secondary">Update role</SubmitButton>
          </form>
          <details className="rounded-xl border border-[#ead6c5] bg-[#fff8f0] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#8a3f1e]">Ownership or removal</summary>
            <div className="mt-4 grid gap-4">
              <form action={transferStudyRoomOwnership} className="space-y-3">
                <input type="hidden" name="room_id" value={roomId} />
                <input type="hidden" name="target_profile_id" value={member.profile_id} />
                <FormField>
                  <FormLabel htmlFor={fieldId("transfer", member.id)}>Type TRANSFER to make this member Owner</FormLabel>
                  <input id={fieldId("transfer", member.id)} name="confirmation" autoComplete="off" className={formControlClassName} />
                </FormField>
                <SubmitButton pendingLabel="Transferring..." variant="danger">Transfer ownership</SubmitButton>
              </form>
              {currentViewerRole === "owner" ? (
                <form action={removeStudyRoomMember} className="space-y-3">
                  <input type="hidden" name="room_id" value={roomId} />
                  <input type="hidden" name="membership_id" value={member.id} />
                  <FormField>
                    <FormLabel htmlFor={fieldId("remove", member.id)}>Type REMOVE to remove this member</FormLabel>
                    <input id={fieldId("remove", member.id)} name="confirmation" autoComplete="off" className={formControlClassName} />
                  </FormField>
                  <SubmitButton pendingLabel="Removing..." variant="danger">Remove member</SubmitButton>
                </form>
              ) : null}
            </div>
          </details>
        </div>
      ) : null}
    </article>
  );
}

function JoinRequestsPanel({ data }: { data: StudyRoomDetailData }) {
  const room = data.room;
  if (!room) return null;
  return (
    <ContentCard as="section">
      <SectionHeader title="Pending join requests" />
      {data.pendingJoinRequests.length === 0 ? (
        <p className="mt-4 text-sm text-[#67564c]">No pending join requests.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {data.pendingJoinRequests.map((request) => (
            <article key={request.id} className="rounded-xl border border-[#ead6c5] bg-white/70 p-4">
              <h3 className="font-semibold">{request.display_name}</h3>
              {request.message ? <p className="mt-2 text-sm leading-6 text-[#67564c]">{request.message}</p> : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={reviewStudyRoomJoinRequest}>
                  <input type="hidden" name="room_id" value={room.id} />
                  <input type="hidden" name="request_id" value={request.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <SubmitButton pendingLabel="Approving..." variant="secondary">Approve</SubmitButton>
                </form>
                <form action={reviewStudyRoomJoinRequest}>
                  <input type="hidden" name="room_id" value={room.id} />
                  <input type="hidden" name="request_id" value={request.id} />
                  <input type="hidden" name="decision" value="deny" />
                  <SubmitButton pendingLabel="Declining..." variant="danger">Decline</SubmitButton>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </ContentCard>
  );
}

function InvitationPanel({
  data,
  inviteQuery,
  inviteResults,
}: {
  data: StudyRoomDetailData;
  inviteQuery: string;
  inviteResults: StudyRoomInviteSearchResult[];
}) {
  const room = data.room;
  if (!room) return null;
  return (
    <ContentCard as="section">
      <SectionHeader title="Invitations" description="Search by display name or username. Email addresses and private profile fields are not shown." />
      <form className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <input type="hidden" name="section" value="members" />
        <FormField>
          <FormLabel htmlFor="invite-search">Find a member to invite</FormLabel>
          <input id="invite-search" name="invite_q" minLength={3} maxLength={80} defaultValue={inviteQuery} placeholder="At least 3 characters" className={formControlClassName} />
          <FormHint>Search is limited and excludes current members and pending invitees.</FormHint>
        </FormField>
        <SubmitButton pendingLabel="Searching..." variant="secondary">Search</SubmitButton>
      </form>
      {inviteQuery.trim().length > 0 && inviteQuery.trim().length < 3 ? (
        <p className="mt-4 text-sm font-semibold text-[#8a3f1e]">Enter at least 3 characters to search.</p>
      ) : null}
      {inviteQuery.trim().length >= 3 ? (
        <div className="mt-5 space-y-3">
          {inviteResults.length === 0 ? <p className="text-sm text-[#67564c]">No eligible profiles found.</p> : null}
          {inviteResults.map((profile) => (
            <article key={profile.id} className="rounded-xl border border-[#ead6c5] bg-white/70 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold">{profile.display_name}</h3>
                  {profile.username ? <p className="mt-1 break-words text-sm text-[#67564c]">@{profile.username}</p> : null}
                </div>
                <form action={inviteStudyRoomMember} className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
                  <input type="hidden" name="room_id" value={room.id} />
                  <input type="hidden" name="profile_id" value={profile.id} />
                  <FormField>
                    <FormLabel htmlFor={`invite-role-${profile.id}`}>Role</FormLabel>
                    <select id={`invite-role-${profile.id}`} name="role" defaultValue="member" className={formControlClassName}>
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="leader">Leader</option>
                    </select>
                  </FormField>
                  <FormField>
                    <FormLabel htmlFor={`invite-message-${profile.id}`}>Message</FormLabel>
                    <input id={`invite-message-${profile.id}`} name="message" maxLength={1000} className={formControlClassName} />
                  </FormField>
                  <SubmitButton pendingLabel="Inviting..."><UserPlus aria-hidden="true" className="h-4 w-4" />Invite</SubmitButton>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {data.pendingInvitations.length === 0 ? (
        <p className="mt-5 text-sm text-[#67564c]">No pending invitations.</p>
      ) : (
        <ul className="mt-5 space-y-2 text-sm text-[#67564c]">
          {data.pendingInvitations.map((invite) => (
            <li key={invite.id} className="rounded-xl bg-[#fff4e8] p-3">
              {invite.display_name} - {formatStudyRoomRole(invite.role)}
            </li>
          ))}
        </ul>
      )}
    </ContentCard>
  );
}

function SettingsSection({ data }: { data: StudyRoomDetailData }) {
  const room = data.room;
  if (!room || !data.viewer.canLead) return null;

  return (
    <div className="space-y-6">
      <ContentCard as="section">
        <SectionHeader title="Settings" description="Update the room overview, Scripture, visibility, membership mode, and status." />
        <form action={updateStudyRoomSettings} className="mt-5 space-y-5">
          <input type="hidden" name="room_id" value={room.id} />
          <input type="hidden" name="return_to" value={`/study-rooms/${room.id}?section=settings`} />
          <FormField>
            <FormLabel htmlFor="settings-name" required>Name</FormLabel>
            <input id="settings-name" name="name" required maxLength={120} defaultValue={room.name} className={formControlClassName} />
          </FormField>
          <FormField>
            <FormLabel htmlFor="settings-description" required>Description</FormLabel>
            <textarea id="settings-description" name="description" required rows={5} defaultValue={room.description} className={formControlClassName} />
          </FormField>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField>
              <FormLabel htmlFor="settings-topic">Study topic</FormLabel>
              <input id="settings-topic" name="study_topic" defaultValue={room.study_topic || ""} className={formControlClassName} />
            </FormField>
            <FormField>
              <FormLabel htmlFor="settings-book">Primary Bible book</FormLabel>
              <input id="settings-book" name="primary_bible_book" defaultValue={room.primary_bible_book || ""} className={formControlClassName} />
            </FormField>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField>
              <FormLabel htmlFor="settings-current-scripture">Current Scripture</FormLabel>
              <input id="settings-current-scripture" name="current_scripture_reference" defaultValue={room.current_scripture_reference || ""} className={formControlClassName} />
            </FormField>
            <FormField>
              <FormLabel htmlFor="settings-pinned-scripture">Pinned Scripture</FormLabel>
              <input id="settings-pinned-scripture" name="pinned_scripture_reference" defaultValue={room.pinned_scripture_reference || ""} className={formControlClassName} />
            </FormField>
          </div>
          <FormField>
            <FormLabel htmlFor="settings-cover">External cover image URL</FormLabel>
            <input id="settings-cover" name="cover_image_url" type="url" defaultValue={room.cover_image_url || ""} className={formControlClassName} />
            <FormHint>Leave blank to clear the cover image. File uploads are not part of Phase 1.</FormHint>
          </FormField>
          <div className="grid gap-5 md:grid-cols-3">
            <FormField>
              <FormLabel htmlFor="settings-visibility">Visibility</FormLabel>
              <select id="settings-visibility" name="visibility" defaultValue={room.visibility} className={formControlClassName}>
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
              </select>
            </FormField>
            <FormField>
              <FormLabel htmlFor="settings-membership-mode">Membership mode</FormLabel>
              <select id="settings-membership-mode" name="membership_mode" defaultValue={room.membership_mode} className={formControlClassName}>
                <option value="open_join">Open join</option>
                <option value="request_to_join">Request to join</option>
                <option value="invite_only">Invite only</option>
              </select>
            </FormField>
            <FormField>
              <FormLabel htmlFor="settings-status">Status</FormLabel>
              <select id="settings-status" name="status" defaultValue={room.status} className={formControlClassName}>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </FormField>
          </div>
          <FormActions>
            <SubmitButton pendingLabel="Saving...">Save settings</SubmitButton>
          </FormActions>
        </form>
      </ContentCard>
      {data.viewer.canManage ? (
        <ConfirmActionPanel
          action={archiveStudyRoom}
          hiddenFields={{ room_id: room.id }}
          title="Archive this Study Room"
          description="Archiving makes the room read-only and removes it from active discovery. This does not delete the room."
          actionLabel="Archive room"
          confirmationValue="ARCHIVE"
          confirmationId="archive-study-room"
        />
      ) : null}
    </div>
  );
}

export function StudyRoomDetail({
  data,
  activeSection,
  inviteQuery,
  inviteResults,
  filters,
}: {
  data: StudyRoomDetailData;
  activeSection: string;
  inviteQuery: string;
  inviteResults: StudyRoomInviteSearchResult[];
  filters: StudyRoomDetailFilters;
}) {
  const room = data.room;
  if (!room) {
    return <EmptyState icon={Shield} title="Study Room unavailable" description="This room may not exist, may be private, or may no longer be accessible." />;
  }
  const safeSection = sectionItems.some(([key]) => key === activeSection) ? activeSection : "overview";
  const section = safeSection === "settings" && !data.viewer.canLead ? "overview" : safeSection;

  return (
    <>
      <SectionNav roomId={room.id} active={section} canManage={data.viewer.canLead} />
      {room.status === "archived" ? (
        <ContentCard as="section" className="mt-6 border-[#d79568] bg-[#fff4e8]">
          <p className="flex items-center gap-2 font-semibold text-[#8a3f1e]">
            <Archive aria-hidden="true" className="h-4 w-4" />
            This Study Room is archived and read-only.
          </p>
        </ContentCard>
      ) : null}
      <div className="mt-8">
        {section === "overview" ? <OverviewSection data={data} /> : null}
        {section === "studies" ? <StudiesSection data={data} /> : null}
        {section === "notes" ? <NotesSection data={data} filters={filters} /> : null}
        {section === "discussion" ? <DiscussionsSection data={data} filters={filters} /> : null}
        {section === "prayer" ? <PrayerSection data={data} filters={filters} /> : null}
        {section === "resources" ? <ResourcesSection data={data} filters={filters} /> : null}
        {section === "members" ? <MembersSection data={data} inviteQuery={inviteQuery} inviteResults={inviteResults} /> : null}
        {section === "settings" ? <SettingsSection data={data} /> : null}
      </div>
    </>
  );
}
