import Link from "next/link";

export default function NewCommunityPage() {
  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#ead6c5] bg-white/75 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">Open community</p>
        <h1 className="mt-4 text-3xl font-semibold">Selah Ember now uses one open community.</h1>
        <p className="mt-4 leading-7 text-[#67564c]">
          You do not need to create a church community. You can post in the community feed or create a Bible study group.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/community" className="inline-flex justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
            Open community
          </Link>
          <Link href="/groups/new" className="inline-flex justify-center rounded-full border border-[#2f2722]/20 px-5 py-3 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]">
            Create group
          </Link>
        </div>
      </div>
    </section>
  );
}
