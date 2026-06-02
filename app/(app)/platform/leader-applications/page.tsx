import Link from "next/link";
import { requirePlatformEngineer } from "@/lib/platform/auth";

export default async function PlatformLeaderApplicationsPage() {
  await requirePlatformEngineer();

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#ead6c5] bg-white/75 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">Verification retired</p>
        <h1 className="mt-4 text-3xl font-semibold">Leader applications are no longer used.</h1>
        <p className="mt-4 leading-7 text-[#67564c]">
          Selah Ember now uses an open community model with normal users and platform engineers only.
        </p>
        <Link href="/platform" className="mt-6 inline-flex rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
          Back to platform
        </Link>
      </div>
    </section>
  );
}
