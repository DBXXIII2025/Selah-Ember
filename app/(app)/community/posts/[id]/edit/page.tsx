import Link from "next/link";
import { notFound } from "next/navigation";
import { getOpenCommunityPostForEdit, updateOpenCommunityPostWithState } from "@/app/actions/community-posts";
import { CommunityPostActionForm } from "@/components/community/community-post-action-form";
import { FormNotice, PageContainer, PageHeader } from "@/components/ui/app-ui";

type EditCommunityPostPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditCommunityPostPage({ params, searchParams }: EditCommunityPostPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getOpenCommunityPostForEdit(id);

  if (!data.community || !data.post || !data.post.can_edit) {
    notFound();
  }

  const returnTo = `/community/posts/${id}`;

  return (
    <PageContainer className="py-10">
      <Link href={returnTo} className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
        Back to post
      </Link>
      <PageHeader
        eyebrow="Community"
        title="Edit post"
        description="Update your post without changing its author, topic, comments, reactions, reports, or original creation date."
        bordered
        className="mt-4"
      />
      {query.message ? <FormNotice className="mt-6">{query.message}</FormNotice> : null}
      <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/80 p-6 shadow-sm">
        <CommunityPostActionForm
          action={updateOpenCommunityPostWithState}
          communityId={data.community.id}
          returnTo={returnTo}
          submitLabel="Save post"
          showPublishToggle={false}
          post={data.post}
        />
      </div>
    </PageContainer>
  );
}
