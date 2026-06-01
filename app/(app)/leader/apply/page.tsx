import Link from "next/link";
import { getMyLeaderApplications, submitLeaderApplication } from "@/app/actions/leader-applications";
import { getCurrentAuthAndProfile } from "@/lib/auth/current";

type LeaderApplyPageProps = {
  searchParams: Promise<{ message?: string }>;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export default async function LeaderApplyPage({ searchParams }: LeaderApplyPageProps) {
  const [{ profile }, applications, params] = await Promise.all([
    getCurrentAuthAndProfile(),
    getMyLeaderApplications(),
    searchParams,
  ]);

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/leader" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to leader dashboard
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
          Leader verification
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Apply as a church leader</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
          Verified church leaders can publish official communities, events, media, and community updates. Pending leaders can draft communities while verification is reviewed.
        </p>

        {params.message ? (
          <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
            {params.message}
          </p>
        ) : null}

        <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#8a3f1e]">Current role: {profile.role}</p>
          <form action={submitLeaderApplication} className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-[#3b312b]">Church or ministry name</span>
              <input name="church_name" required className={inputClassName} />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Website URL</span>
                <input name="website_url" type="url" className={inputClassName} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[#3b312b]">Church email</span>
                <input name="church_email" type="email" className={inputClassName} />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-[#3b312b]">Social URL</span>
              <input name="social_url" type="url" className={inputClassName} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#3b312b]">Description</span>
              <textarea name="description" rows={5} className={inputClassName} />
            </label>
            <button type="submit" className="rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
              Submit application
            </button>
          </form>
        </div>

        {applications.length > 0 ? (
          <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Application history</h2>
            <div className="mt-5 space-y-3">
              {applications.map((application) => (
                <div key={application.id} className="rounded-xl bg-[#fff4e8] p-4 text-sm">
                  <p className="font-semibold">{application.church_name}</p>
                  <p className="mt-1 text-[#67564c]">
                    {application.status} · submitted {formatDate(application.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
