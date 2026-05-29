import Link from "next/link";
import { CommunityForm } from "@/components/church/community-form";

type NewCommunityPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function NewCommunityPage({ searchParams }: NewCommunityPageProps) {
  const { message } = await searchParams;

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
        <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
          Give your community a simple public presence and a protected place to grow from.
        </p>
        <div className="mt-10">
          <CommunityForm message={message} />
        </div>
      </div>
    </section>
  );
}
