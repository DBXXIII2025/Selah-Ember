import Link from "next/link";
import { getCommunityCreationAccess } from "@/app/actions/communities";
import { CommunityForm } from "@/components/church/community-form";

type NewCommunityPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function NewCommunityPage({ searchParams }: NewCommunityPageProps) {
  const [params, access] = await Promise.all([searchParams, getCommunityCreationAccess()]);

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/communities" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to communities
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
          New community
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Create a fellowship space</h1>
        {access.canCreate ? (
          <>
            <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
              {access.createsDraft
                ? "Pending Verification - your community is saved as a draft and will not be public until approval."
                : "Give your community a simple public presence and a protected place to grow from."}
            </p>
            <div className="mt-10">
              <CommunityForm message={params.message || access.message || undefined} draftMode={access.createsDraft} />
            </div>
          </>
        ) : (
          <div className="mt-10 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Leader verification required</h2>
            <p className="mt-3 leading-7 text-[#67564c]">
              {params.message || access.message}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/leader/apply" className="inline-flex justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]">
                Apply as leader
              </Link>
              <Link href="/groups/new" className="inline-flex justify-center rounded-full border border-[#2f2722]/20 px-5 py-3 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]">
                Create study group
              </Link>
              <Link href="/discover" className="inline-flex justify-center rounded-full border border-[#2f2722]/20 px-5 py-3 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]">
                Discover communities
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
