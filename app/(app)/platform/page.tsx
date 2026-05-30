import {
  createPlatformDirectMessageIntent,
  createTemporaryBan,
  deletePlatformAnnouncement,
  deletePlatformPlan,
  deletePromoCode,
  getPlatformDashboardData,
  savePlatformPlan,
  savePromoCode,
  sendPlatformAnnouncement,
  updatePlatformSettings,
} from "@/app/actions/platform";

type PlatformPageProps = {
  searchParams: Promise<{
    message?: string;
    search?: string;
  }>;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";
const buttonClassName =
  "rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]";
const deleteButtonClassName =
  "rounded-full border border-[#b42318]/30 bg-white px-5 py-3 text-sm font-semibold text-[#b42318] transition hover:bg-[#fff1f0]";

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
    <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default async function PlatformPage({ searchParams }: PlatformPageProps) {
  const params = await searchParams;
  const data = await getPlatformDashboardData(params.search || "");

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
          Platform Engineer
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Platform controls</h1>
        <p className="mt-4 max-w-3xl leading-7 text-[#67564c]">
          Manage site settings, plans, announcements, user support foundations, and moderation.
        </p>

        {params.message ? (
          <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
            {params.message}
          </p>
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
              <button type="submit" className={buttonClassName}>
                Save settings
              </button>
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
              <button type="submit" className={buttonClassName}>
                Create plan
              </button>
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
                    <button type="submit" className={`${buttonClassName} mt-4`}>
                      Update plan
                    </button>
                  </form>
                  <form action={deletePlatformPlan} className="mt-5 border-t border-[#ead6c5] pt-4">
                    <input type="hidden" name="plan_id" value={plan.id} />
                    <p className="text-sm text-[#67564c]">
                      Type DELETE to deactivate this plan. Existing records are kept.
                    </p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input name="confirmation" type="text" className={inputClassName} />
                      <button type="submit" className={deleteButtonClassName}>
                        Delete plan
                      </button>
                    </div>
                  </form>
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
              <button type="submit" className={buttonClassName}>
                Create promo
              </button>
            </form>
            <div className="mt-6 space-y-3">
              {data.promos.map((promo) => (
                <div key={promo.id} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                  <p className="font-semibold">{promo.code} - {promo.discount_label}</p>
                  <p className="mt-1 text-[#67564c]">{promo.description || "No description"} · {promo.is_active ? "Active" : "Inactive"}</p>
                  <form action={deletePromoCode} className="mt-4 border-t border-[#ead6c5] pt-4">
                    <input type="hidden" name="promo_id" value={promo.id} />
                    <p className="text-[#67564c]">Type DELETE to deactivate this promo code.</p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input name="confirmation" type="text" className={inputClassName} />
                      <button type="submit" className={deleteButtonClassName}>
                        Delete promo
                      </button>
                    </div>
                  </form>
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
              <button type="submit" className={buttonClassName}>
                Send to all users
              </button>
            </form>
            <div className="mt-6 space-y-3">
              {data.announcements.map((announcement) => (
                <div key={announcement.id} className="rounded-xl border border-[#ead6c5] p-4 text-sm">
                  <p className="font-semibold">{announcement.title}</p>
                  <p className="mt-1 text-[#67564c]">{announcement.body}</p>
                  <form action={deletePlatformAnnouncement} className="mt-4 border-t border-[#ead6c5] pt-4">
                    <input type="hidden" name="announcement_id" value={announcement.id} />
                    <p className="text-[#67564c]">Type DELETE to remove this announcement row.</p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input name="confirmation" type="text" className={inputClassName} />
                      <button type="submit" className={deleteButtonClassName}>
                        Delete announcement
                      </button>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="User messaging foundation">
            <p className="mb-5 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
              Admin-side intent only. Delivery depends on Phase 13 direct messaging.
            </p>
            <form action={createPlatformDirectMessageIntent} className="space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">User</span>
                <select name="target_user_id" required className={inputClassName}>
                  <option value="">Choose a user</option>
                  {data.users.map((user) => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.display_name} {user.email ? `(${user.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Subject" name="subject" required />
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Body</span>
                <textarea name="body" rows={4} required className={inputClassName} />
              </label>
              <button type="submit" className={buttonClassName}>
                Save message intent
              </button>
            </form>
          </Panel>

          <Panel title="Moderation">
            <form className="mb-6">
              <Field label="Search users" name="search" defaultValue={params.search} />
              <button type="submit" className={`${buttonClassName} mt-4`}>
                Search
              </button>
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
              <button type="submit" className={buttonClassName}>
                Create ban
              </button>
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
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel title="Communities">
            <div className="space-y-3 text-sm">
              {data.communities.map((community) => (
                <p key={community.id} className="rounded-xl border border-[#ead6c5] p-3">
                  {community.name}
                </p>
              ))}
            </div>
          </Panel>
          <Panel title="Groups">
            <div className="space-y-3 text-sm">
              {data.groups.map((group) => (
                <p key={group.id} className="rounded-xl border border-[#ead6c5] p-3">
                  {group.title}
                </p>
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
      </div>
    </section>
  );
}
