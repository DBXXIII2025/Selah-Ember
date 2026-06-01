import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommunityPostForLeader, updateCommunityPost } from "@/app/actions/community-posts";
import { CommunityPostForm } from "@/components/community/community-post-form";

type EditCommunityUpdatePageProps = {
  params: Promise<{ id: string; postId: string }>;
};

export default async function EditCommunityUpdatePage({ params }: EditCommunityUpdatePageProps) {
  const { id, postId } = await params;
  const data = await getCommunityPostForLeader(id, postId);

  if (!data.community || !data.post) {
    notFound();
  }

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <Link href={`/leader/communities/${id}/updates`} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to updates
        </Link>
        <h1 className="mt-3 text-4xl font-semibold">Edit community update</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[#67564c]">
          Update this official community post.
        </p>
        <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
          <CommunityPostForm
            action={updateCommunityPost}
            communityId={id}
            returnTo={`/leader/communities/${id}/updates`}
            submitLabel="Save update"
            post={data.post}
          />
        </div>
      </div>
    </section>
  );
}
