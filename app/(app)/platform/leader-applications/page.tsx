import Link from "next/link";
import {
  approveLeaderApplication,
  getLeaderApplicationsForPlatform,
  rejectLeaderApplication,
} from "@/app/actions/leader-applications";

type PlatformLeaderApplicationsPageProps = {
  searchParams: Promise<{ message?: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export default async function PlatformLeaderApplicationsPage({ searchParams }: PlatformLeaderApplicationsPageProps) {
  const [applications, params] = await Promise.all([getLeaderApplicationsForPlatform(), searchParams]);

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <Link href="/platform" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to platform
        </Link>
        <h1 className="mt-3 text-4xl font-semibold">Leader applications</h1>
        <p className="mt-4 max-w-3xl leading-7 text-[#67564c]">
          Review pending church leader verification requests.
        </p>

        {params.message ? (
          <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
            {params.message}
          </p>
        ) : null}

        <div className="mt-8 grid gap-5">
          {applications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
              <h2 className="text-2xl font-semibold">No applications yet</h2>
            </div>
          ) : (
            applications.map((application) => (
              <article key={application.id} className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
                <div className="flex flex-col justify-between gap-4 lg:flex-row">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
                      {application.status}
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold">{application.church_name}</h2>
                    <p className="mt-2 text-sm text-[#67564c]">
                      {application.applicant?.display_name || "Unknown applicant"} · {application.applicant?.role || "user"} · submitted {formatDate(application.created_at)}
                    </p>
                    {application.church_email ? <p className="mt-3 text-sm text-[#67564c]">{application.church_email}</p> : null}
                    {application.website_url ? <p className="mt-1 break-all text-sm text-[#67564c]">{application.website_url}</p> : null}
                    {application.social_url ? <p className="mt-1 break-all text-sm text-[#67564c]">{application.social_url}</p> : null}
                    {application.description ? (
                      <p className="mt-4 whitespace-pre-wrap leading-7 text-[#3b312b]">{application.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                    <form action={approveLeaderApplication}>
                      <input type="hidden" name="application_id" value={application.id} />
                      <button type="submit" className="w-full rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
                        Approve
                      </button>
                    </form>
                    <form action={rejectLeaderApplication}>
                      <input type="hidden" name="application_id" value={application.id} />
                      <button type="submit" className="w-full rounded-full border border-[#b42318]/30 bg-white px-5 py-3 text-sm font-semibold text-[#b42318] transition hover:bg-[#fff1f0]">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
