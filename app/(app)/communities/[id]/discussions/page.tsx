import Link from "next/link";

type CommunityDiscussionsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CommunityDiscussionsPage({ params }: CommunityDiscussionsPageProps) {
  await params;

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#ead6c5] bg-white/75 p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">Discussions moved</p>
        <h1 className="mt-4 text-3xl font-semibold">Community discussions have moved to study groups.</h1>
        <p className="mt-4 leading-7 text-[#67564c]">
          Discussions belong to Bible Study Groups. Communities are for membership, events, prayer, media, and groups.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/groups"
            className="inline-flex justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
          >
            Open groups
          </Link>
          <Link
            href="/discover/groups"
            className="inline-flex justify-center rounded-full border border-[#2f2722]/20 px-5 py-3 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
          >
            Discover groups
          </Link>
        </div>
      </div>
    </section>
  );
}
