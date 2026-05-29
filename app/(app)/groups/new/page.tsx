import Link from "next/link";
import { getGroupCommunityOptions } from "@/app/actions/groups";
import { StudyGroupForm } from "@/components/groups/study-group-form";

type NewGroupPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function NewGroupPage({ searchParams }: NewGroupPageProps) {
  const [communities, params] = await Promise.all([getGroupCommunityOptions(), searchParams]);

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/groups" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to groups
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
          New study group
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Create a Bible study group</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
          Start a focused space for Scripture, conversation, and belonging.
        </p>
        <div className="mt-10">
          <StudyGroupForm communities={communities} message={params.message} />
        </div>
      </div>
    </section>
  );
}
