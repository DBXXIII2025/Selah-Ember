import {
  createTemporaryBan,
  deletePlatformCommunity,
  deletePlatformGroup,
  deletePlatformAnnouncement,
  deletePlatformPlan,
  deletePromoCode,
  getPlatformDashboardData,
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
  const data = await getPlatformDashboardData(params.search || "");

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
            <div className="max-h-80 space-y-3 overflow-auto pr-2">
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
                    <select name="role" defaultValue={user.role === "platform_engineer" ? "platform_engineer" : "user"} disabled={user.role === "platform_engineer"} className={inputClassName}>
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
                          {post.author_name || post.author_id} - {new Date(post.created_at).toLocaleString()}
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
                        <p className="font-semibold">{comment.author_name || comment.author_id}</p>
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
          <Panel title="Public prayer">
            <div className="space-y-3 text-sm">
              {data.prayer_requests.map((request) => (
                <p key={request.id} className="rounded-xl border border-[#ead6c5] p-3">
                  {request.title}
                </p>
              ))}
            </div>
          </Panel>
        </div>
    </PageContainer>
  );
}
