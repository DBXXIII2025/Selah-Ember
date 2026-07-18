import {
  createTemporaryBan,
  deletePlatformCommunity,
  deletePlatformEvent,
  deletePlatformGroup,
  deletePlatformAnnouncement,
  deletePlatformPlan,
  deletePlatformPrayerRequest,
  deletePromoCode,
  getPlatformDashboardData,
  archiveReportedStudyRoom,
  lockReportedStudyRoomThread,
  removeReportedStudyRoomContent,
  reviewStudyRoomReport,
  savePlatformPlan,
  savePromoCode,
  sendPlatformAnnouncement,
  updatePlatformUserRole,
  updatePlatformSettings,
} from "@/app/actions/platform";
import { deleteOwnReply, deleteOwnThread } from "@/app/actions/discussions";
import { deleteOpenCommunityComment, deleteOpenCommunityPost } from "@/app/actions/community-posts";
import { deleteMediaItem } from "@/app/actions/media";
import {
  ActionButton,
  ConfirmActionPanel,
  ContentCard,
  FormNotice,
  PageContainer,
  PageHeader,
  formControlClassName,
} from "@/components/ui/app-ui";

type PlatformPageProps = {
  searchParams: Promise<{
    message?: string;
    search?: string;
    sr_status?: string;
    sr_target?: string;
    sr_room?: string;
  }>;
};

const inputClassName = formControlClassName;

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
}: Readonly<{
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
}>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#3b312b]">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue || ""}
        className={inputClassName}
      />
    </label>
  );
}

function Panel({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <ContentCard as="section">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-6">{children}</div>
    </ContentCard>
  );
}

export default async function PlatformPage({ searchParams }: PlatformPageProps) {
  const params = await searchParams;
  const data = await getPlatformDashboardData(params.search || "", {
    status: params.sr_status,
    target: params.sr_target,
    room: params.sr_room,
  });
  const studyRoomFilterFields = {
    sr_status: params.sr_status || "open",
    sr_target: params.sr_target || "all",
    sr_room: params.sr_room || "",
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform Engineer"
        title="Platform controls"
        description="Manage site settings, announcements, user support foundations, and moderation."
      />

        {params.message ? (
          <FormNotice className="mt-6">{params.message}</FormNotice>
        ) : null}

        <div className="mt-10 grid gap-6 xl:grid-cols-2">
          <Panel title="Site settings">
            <form action={updatePlatformSettings} className="space-y-5">
              <Field label="Site name" name="site_name" defaultValue={data.settings.site_name} required />
              <Field label="Site tagline" name="site_tagline" defaultValue={data.settings.site_tagline} />
              <Field label="Website logo URL" name="logo_url" type="url" defaultValue={data.settings.logo_url} />
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Homepage announcement</span>
                <textarea
                  name="homepage_announcement"
                  rows={3}
                  defaultValue={data.settings.homepage_announcement || ""}
                  className={inputClassName}
                />
              </label>
              <Field label="Support/contact info" name="support_contact" defaultValue={data.settings.support_contact} />
              <ActionButton type="submit">Save settings</ActionButton>
            </form>
          </Panel>

          <Panel title="Create pricing plan">
            <form action={savePlatformPlan} className="space-y-5">
              <Field label="Plan name" name="name" required />
              <Field label="Price label" name="price_label" required />
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Description</span>
                <textarea name="description" rows={3} className={inputClassName} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Features, one per line</span>
                <textarea name="features" rows={4} className={inputClassName} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Intended audience</span>
                <select name="intended_audience" defaultValue="individual" className={inputClassName}>
                  <option value="individual">Individual</option>
                  <option value="church">Church</option>
                  <option value="ministry">Ministry</option>
                </select>
              </label>
              <label className="flex items-center gap-3 text-sm font-medium text-[#3b312b]">
                <input name="is_active" type="checkbox" defaultChecked className="h-4 w-4" />
                Active
              </label>
              <ActionButton type="submit">Create plan</ActionButton>
            </form>
          </Panel>

          <Panel title="Plans">
            <div className="space-y-5">
              {data.plans.length === 0 ? (
                <p className="text-sm text-[#67564c]">No plans yet.</p>
              ) : (
                data.plans.map((plan) => (
                  <div key={plan.id} className="rounded-xl border border-[#ead6c5] p-4">
                  <form action={savePlatformPlan}>
                    <input type="hidden" name="plan_id" value={plan.id} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Plan name" name="name" defaultValue={plan.name} required />
                      <Field label="Price label" name="price_label" defaultValue={plan.price_label} required />
                    </div>
                    <label className="mt-4 block">
                      <span className="text-sm font-medium text-[#3b312b]">Description</span>
                      <textarea
                        name="description"
                        rows={2}
                        defaultValue={plan.description || ""}
                        className={inputClassName}
                      />
                    </label>
                    <label className="mt-4 block">
                      <span className="text-sm font-medium text-[#3b312b]">Features</span>
                      <textarea
                        name="features"
                        rows={3}
                        defaultValue={plan.features.join("\n")}
                        className={inputClassName}
                      />
                    </label>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-medium text-[#3b312b]">Audience</span>
                        <select
                          name="intended_audience"
                          defaultValue={plan.intended_audience}
                          className={inputClassName}
                        >
                          <option value="individual">Individual</option>
                          <option value="church">Church</option>
                          <option value="ministry">Ministry</option>
                        </select>
                      </label>
                      <label className="mt-8 flex items-center gap-3 text-sm font-medium text-[#3b312b]">
                        <input name="is_active" type="checkbox" defaultChecked={plan.is_active} className="h-4 w-4" />
                        Active
                      </label>
                    </div>
                    <ActionButton type="submit" className="mt-4">Update plan</ActionButton>
                  </form>
                  <ConfirmActionPanel
                    action={deletePlatformPlan}
                    hiddenFields={{ plan_id: plan.id }}
                    title="Deactivate this plan"
                    description="Existing records are retained, but the plan will no longer remain active."
                    actionLabel="Deactivate plan"
                    confirmationId={`delete-plan-${plan.id}`}
                    className="mt-5"
                  />
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Promo codes">
            <form action={savePromoCode} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Code" name="code" required />
                <Field label="Discount label" name="discount_label" required />
              </div>
              <Field label="Description" name="description" />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Starts at" name="starts_at" type="datetime-local" />
                <Field label="Ends at" name="ends_at" type="datetime-local" />
              </div>
              <label className="flex items-center gap-3 text-sm font-medium text-[#3b312b]">
                <input name="is_active" type="checkbox" defaultChecked className="h-4 w-4" />
                Active
              </label>
              <ActionButton type="submit">Create promo</ActionButton>
            </form>
            <div className="mt-6 space-y-3">
              {data.promos.map((promo) => (
                <div key={promo.id} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                  <p className="font-semibold">{promo.code} - {promo.discount_label}</p>
                  <p className="mt-1 text-[#67564c]">{promo.description || "No description"} · {promo.is_active ? "Active" : "Inactive"}</p>
                  <ConfirmActionPanel
                    action={deletePromoCode}
                    hiddenFields={{ promo_id: promo.id }}
                    title="Deactivate this promo code"
                    description="The code will no longer be available for future use."
                    actionLabel="Deactivate promo"
                    confirmationId={`delete-promo-${promo.id}`}
                    className="mt-4"
                  />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Platform announcements">
            <form action={sendPlatformAnnouncement} className="space-y-5">
              <Field label="Title" name="title" required />
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Body</span>
                <textarea name="body" rows={4} required className={inputClassName} />
              </label>
              <Field label="Href" name="href" />
              <ActionButton type="submit">Send to all users</ActionButton>
            </form>
            <div className="mt-6 space-y-3">
              {data.announcements.map((announcement) => (
                <div key={announcement.id} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                  <p className="font-semibold">{announcement.title}</p>
                  <p className="mt-1 text-[#67564c]">{announcement.body}</p>
                  <ConfirmActionPanel
                    action={deletePlatformAnnouncement}
                    hiddenFields={{ announcement_id: announcement.id }}
                    title="Delete this announcement"
                    description="This removes the platform announcement record."
                    actionLabel="Delete announcement"
                    confirmationId={`delete-announcement-${announcement.id}`}
                    className="mt-4"
                  />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="User messaging foundation">
            <p className="mb-5 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
              Open the platform inbox to search users, start support conversations, and reply with text, links, images, or video.
            </p>
            <ActionButton href="/platform/messages">Open platform messages</ActionButton>
          </Panel>

          <Panel title="Open community model">
            <p className="mb-5 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
              Open participation is active. Users can post, pray, create groups, message, and join group discussions.
            </p>
            <ActionButton href="/community">Open community feed</ActionButton>
          </Panel>

          <Panel title="Moderation">
            <form className="mb-6">
              <Field label="Search users" name="search" defaultValue={params.search} />
              <ActionButton type="submit" className="mt-4">Search</ActionButton>
            </form>
            <div className="max-h-80 space-y-3 overflow-auto pr-2" tabIndex={0} aria-label="User moderation search results">
              {data.users.map((user) => (
                <div key={user.id} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                  <p className="font-semibold">{user.display_name}</p>
                  <p className="mt-1 break-words text-[#67564c]">
                    {user.email || "No email"} · {user.role} · {user.user_id}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="User roles">
            <div className="space-y-3">
              {data.users.map((user) => (
                <form key={user.id} action={updatePlatformUserRole} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                  <input type="hidden" name="profile_id" value={user.id} />
                  <p className="font-semibold">{user.display_name}</p>
                  <p className="mt-1 break-words text-[#67564c]">
                    {user.email || "No email"} · current role: {user.role}
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <select
                      name="role"
                      aria-label={`Role for ${user.display_name}`}
                      defaultValue={user.role === "platform_engineer" ? "platform_engineer" : "user"}
                      disabled={user.role === "platform_engineer"}
                      className={inputClassName}
                    >
                      <option value="user">User</option>
                      <option value="platform_engineer">Platform engineer</option>
                    </select>
                    <ActionButton type="submit" disabled={user.role === "platform_engineer"}>Update role</ActionButton>
                  </div>
                </form>
              ))}
            </div>
          </Panel>

          <Panel title="Temporary bans">
            <form action={createTemporaryBan} className="space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">User</span>
                <select name="banned_user_id" required className={inputClassName}>
                  <option value="">Choose a user</option>
                  {data.users.map((user) => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.display_name} {user.email ? `(${user.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Reason" name="reason" required />
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Duration</span>
                <select name="duration" required defaultValue="3_days" className={inputClassName}>
                  <option value="3_days">3 days</option>
                  <option value="1_week">1 week</option>
                  <option value="1_month">1 month</option>
                  <option value="custom">Custom until date</option>
                </select>
              </label>
              <Field label="Custom until" name="custom_until" type="datetime-local" />
              <ActionButton type="submit">Create ban</ActionButton>
            </form>
            <div className="mt-6 space-y-3">
              {data.bans.map((ban) => (
                <div key={ban.id} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                  <p className="font-semibold">{ban.reason}</p>
                  <p className="mt-1 break-words text-[#67564c]">
                    {ban.banned_user_id} · until {new Date(ban.expires_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Message reports">
            <div className="space-y-3">
              {data.message_reports.length === 0 ? (
                <p className="text-sm text-[#67564c]">No message reports yet.</p>
              ) : (
                data.message_reports.map((report) => (
                  <div key={report.id} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                    <p className="font-semibold">{report.reason}</p>
                    <p className="mt-1 break-words text-[#67564c]">
                      Conversation {report.conversation_id}
                      {report.message_id ? ` - message ${report.message_id}` : ""}
                    </p>
                    {report.details ? <p className="mt-2 text-[#67564c]">{report.details}</p> : null}
                    <p className="mt-2 text-[#8a3f1e]">
                      Reported {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Study Rooms moderation">
            <form className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
              <Field label="Room filter" name="sr_room" defaultValue={params.sr_room} />
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Status</span>
                <select name="sr_status" defaultValue={params.sr_status || "open"} className={inputClassName}>
                  <option value="open">Open first</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="all">All statuses</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Target type</span>
                <select name="sr_target" defaultValue={params.sr_target || "all"} className={inputClassName}>
                  <option value="all">All targets</option>
                  <option value="note">Shared Notes</option>
                  <option value="thread">Discussion Threads</option>
                  <option value="reply">Discussion Replies</option>
                  <option value="prayer">Prayer Requests</option>
                  <option value="resource">Resources</option>
                </select>
              </label>
              <ActionButton type="submit">Filter</ActionButton>
            </form>
            <div className="space-y-4">
              {data.study_room_reports.length === 0 ? (
                <p className="text-sm text-[#67564c]">No Study Room reports match these filters.</p>
              ) : (
                data.study_room_reports.map((report) => {
                  const hiddenFields = {
                    report_id: report.id,
                    ...studyRoomFilterFields,
                  };
                  return (
                    <article key={report.id} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-base font-semibold">{report.reason}</h3>
                          <p className="mt-1 break-words text-[#67564c]">
                            {report.room_name} - {report.room_visibility} - {report.target_type} - {report.status}
                          </p>
                        </div>
                        <ActionButton href={report.href} size="sm" variant="secondary">Open target</ActionButton>
                      </div>
                      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="font-semibold text-[#3b312b]">Target preview</dt>
                          <dd className="mt-1 break-words text-[#67564c]">{report.target_preview}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-[#3b312b]">Reported content author</dt>
                          <dd className="mt-1 break-words text-[#67564c]">{report.target_author_name}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-[#3b312b]">Reporter</dt>
                          <dd className="mt-1 break-words text-[#67564c]">{report.reporter_label}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-[#3b312b]">Created</dt>
                          <dd className="mt-1 text-[#67564c]">{new Date(report.created_at).toLocaleString()}</dd>
                        </div>
                      </dl>
                      {report.details ? <p className="mt-4 break-words rounded-xl bg-[#fff8f0] p-3 text-[#67564c]">{report.details}</p> : null}
                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <form action={reviewStudyRoomReport} className="rounded-xl border border-[#ead6c5] bg-white/70 p-3">
                          {Object.entries(hiddenFields).map(([name, value]) => (
                            <input key={name} type="hidden" name={name} value={value} />
                          ))}
                          <input type="hidden" name="status" value="reviewed" />
                          <ActionButton type="submit" size="sm" variant="secondary">Mark reviewed</ActionButton>
                        </form>
                        <form action={reviewStudyRoomReport} className="rounded-xl border border-[#ead6c5] bg-white/70 p-3">
                          {Object.entries(hiddenFields).map(([name, value]) => (
                            <input key={name} type="hidden" name={name} value={value} />
                          ))}
                          <input type="hidden" name="status" value="resolved" />
                          <ActionButton type="submit" size="sm" variant="secondary">Resolve</ActionButton>
                        </form>
                        <form action={reviewStudyRoomReport} className="rounded-xl border border-[#ead6c5] bg-white/70 p-3">
                          {Object.entries(hiddenFields).map(([name, value]) => (
                            <input key={name} type="hidden" name={name} value={value} />
                          ))}
                          <input type="hidden" name="status" value="dismissed" />
                          <ActionButton type="submit" size="sm" variant="secondary">Dismiss</ActionButton>
                        </form>
                      </div>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {(report.target_type === "thread" || report.target_type === "reply") ? (
                          <ConfirmActionPanel
                            action={lockReportedStudyRoomThread}
                            hiddenFields={hiddenFields}
                            title="Lock reported discussion"
                            description="The discussion stays readable, but new replies are blocked."
                            actionLabel="Lock discussion"
                            confirmationValue="LOCK"
                            confirmationId={`lock-study-room-report-${report.id}`}
                          />
                        ) : null}
                        <ConfirmActionPanel
                          action={removeReportedStudyRoomContent}
                          hiddenFields={hiddenFields}
                          title="Remove reported content"
                          description="This soft-deletes only the reported Study Room item and resolves the report."
                          actionLabel="Remove content"
                          confirmationValue="REMOVE"
                          confirmationId={`remove-study-room-report-${report.id}`}
                        />
                        <ConfirmActionPanel
                          action={archiveReportedStudyRoom}
                          hiddenFields={hiddenFields}
                          title="Archive this Study Room"
                          description="Use only for serious abuse. The room remains readable to authorized users and becomes read-only."
                          actionLabel="Archive room"
                          confirmationValue="ARCHIVE"
                          confirmationId={`archive-study-room-report-${report.id}`}
                        />
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel title="Community feed moderation">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Recent posts</h3>
                <div className="mt-3 space-y-3">
                  {data.community_posts.length === 0 ? (
                    <p className="text-sm text-[#67564c]">No community posts yet.</p>
                  ) : (
                    data.community_posts.map((post) => (
                      <div key={post.id} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                        <p className="font-semibold">{post.title || "Untitled post"}</p>
                        <p className="mt-1 text-[#67564c]">
                          {post.author_name || post.author_id || "Member"} - {new Date(post.created_at).toLocaleString()}
                          {post.deleted_at ? " - deleted" : ""}
                        </p>
                        {post.body ? <p className="mt-2 line-clamp-3 text-[#67564c]">{post.body}</p> : null}
                        {!post.deleted_at ? (
                          <form action={deleteOpenCommunityPost} className="mt-3 border-t border-[#ead6c5] pt-3">
                            <input type="hidden" name="post_id" value={post.id} />
                            <input type="hidden" name="return_to" value="/platform" />
                            <ActionButton type="submit" variant="danger" size="sm">Delete post</ActionButton>
                          </form>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold">Recent comments</h3>
                <div className="mt-3 space-y-3">
                  {data.community_post_comments.length === 0 ? (
                    <p className="text-sm text-[#67564c]">No community comments yet.</p>
                  ) : (
                    data.community_post_comments.map((comment) => (
                      <div key={comment.id} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                        <p className="font-semibold">{comment.author_name || comment.author_id || "Member"}</p>
                        <p className="mt-1 text-[#67564c]">
                          Post {comment.post_id} - {new Date(comment.created_at).toLocaleString()}
                          {comment.deleted_at ? " - deleted" : ""}
                        </p>
                        <p className="mt-2 line-clamp-3 text-[#67564c]">{comment.body}</p>
                        {!comment.deleted_at ? (
                          <form action={deleteOpenCommunityComment} className="mt-3 border-t border-[#ead6c5] pt-3">
                            <input type="hidden" name="comment_id" value={comment.id} />
                            <input type="hidden" name="return_to" value="/platform" />
                            <ActionButton type="submit" variant="danger" size="sm">Delete comment</ActionButton>
                          </form>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Discussion reports">
            <p className="mb-5 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
              Group discussion reports remain active. Community discussion reports are legacy records.
            </p>
            <div className="space-y-3">
              {data.discussion_reports.length === 0 ? (
                <p className="text-sm text-[#67564c]">No discussion reports yet.</p>
              ) : (
                data.discussion_reports.map((report) => (
                  <div key={report.id} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                    <p className="font-semibold">{report.reason}</p>
                    <p className="mt-1 break-words text-[#67564c]">
                      Thread {report.thread_id || "unknown"}
                      {report.reply_id ? ` - reply ${report.reply_id}` : ""}
                    </p>
                    {report.details ? <p className="mt-2 text-[#67564c]">{report.details}</p> : null}
                    <p className="mt-2 text-[#8a3f1e]">
                      Reported {new Date(report.created_at).toLocaleString()}
                    </p>
                    {report.thread_id ? (
                      <form action={deleteOwnThread} className="mt-4 border-t border-[#ead6c5] pt-4">
                        <input type="hidden" name="thread_id" value={report.thread_id} />
                        <input type="hidden" name="return_path" value="/platform" />
                        <ActionButton type="submit" variant="danger" size="sm">Delete thread</ActionButton>
                      </form>
                    ) : null}
                    {report.reply_id ? (
                      <form action={deleteOwnReply} className="mt-4 border-t border-[#ead6c5] pt-4">
                        <input type="hidden" name="reply_id" value={report.reply_id} />
                        <input type="hidden" name="return_path" value="/platform" />
                        <ActionButton type="submit" variant="danger" size="sm">Delete reply</ActionButton>
                      </form>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Recent media">
            <div className="space-y-3">
              {data.media_items.length === 0 ? (
                <p className="text-sm text-[#67564c]">No media items yet.</p>
              ) : (
                data.media_items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-[#67564c]">
                      {item.community_name || "Unknown community"} · {item.media_type} · {item.content_kind}
                    </p>
                    <p className="mt-1 text-[#67564c]">
                      {item.is_published ? "Published" : "Unpublished"}
                      {item.deleted_at ? " · Deleted" : ""}
                    </p>
                    <ConfirmActionPanel
                      action={deleteMediaItem}
                      hiddenFields={{ media_id: item.id, return_to: "/platform" }}
                      title="Delete this media item"
                      description="This removes the media item from its library."
                      actionLabel="Delete media"
                      confirmationId={`platform-delete-media-${item.id}`}
                      className="mt-4"
                    />
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel title="Communities">
            <div className="space-y-3 text-sm">
              {data.communities.map((community) => (
                <div key={community.id} className="rounded-xl border border-[#ead6c5] p-3">
                  <p className="font-semibold">{community.name}</p>
                  <ConfirmActionPanel
                    action={deletePlatformCommunity}
                    hiddenFields={{ community_id: community.id }}
                    title="Delete legacy community"
                    description="This permanently removes the community record."
                    actionLabel="Delete community"
                    confirmationId={`platform-delete-community-${community.id}`}
                    className="mt-3"
                  />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Groups">
            <div className="space-y-3 text-sm">
              {data.groups.map((group) => (
                <div key={group.id} className="rounded-xl border border-[#ead6c5] p-3">
                  <p className="font-semibold">{group.title}</p>
                  <ConfirmActionPanel
                    action={deletePlatformGroup}
                    hiddenFields={{ group_id: group.id }}
                    title="Delete group"
                    description="This permanently removes the group record."
                    actionLabel="Delete group"
                    confirmationId={`platform-delete-group-${group.id}`}
                    className="mt-3"
                  />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Events">
            <div className="space-y-3 text-sm">
              {data.events.length === 0 ? (
                <p className="text-sm text-[#67564c]">No events yet.</p>
              ) : (
                data.events.map((event) => (
                  <div key={event.id} className="rounded-xl border border-[#ead6c5] p-3">
                    <p className="font-semibold">{event.title}</p>
                    <p className="mt-1 text-[#67564c]">{new Date(event.event_time).toLocaleString()}</p>
                    <ConfirmActionPanel
                      action={deletePlatformEvent}
                      hiddenFields={{ event_id: event.id }}
                      title="Delete event"
                      description="This removes the event and related RSVP rows from the active database."
                      actionLabel="Delete event"
                      confirmationId={`platform-delete-event-${event.id}`}
                      className="mt-3"
                    />
                  </div>
                ))
              )}
            </div>
          </Panel>
          <Panel title="Public prayer">
            <div className="space-y-3 text-sm">
              {data.prayer_requests.length === 0 ? (
                <p className="text-sm text-[#67564c]">No public prayer requests yet.</p>
              ) : (
                data.prayer_requests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-[#ead6c5] p-3">
                    <p className="font-semibold">{request.title}</p>
                    <p className="mt-1 text-[#67564c]">
                      Created {new Date(request.created_at).toLocaleString()}
                    </p>
                    <ConfirmActionPanel
                      action={deletePlatformPrayerRequest}
                      hiddenFields={{ request_id: request.id }}
                      title="Delete prayer request"
                      description="This removes the prayer request from the active database."
                      actionLabel="Delete request"
                      confirmationId={`platform-delete-prayer-${request.id}`}
                      className="mt-3"
                    />
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
    </PageContainer>
  );
}
