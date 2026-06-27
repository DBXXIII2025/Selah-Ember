import { Megaphone } from "lucide-react";
import { notFound } from "next/navigation";
import { deleteCommunityPost, getCommunityPostsForLeader } from "@/app/actions/community-posts";
import { CommunityPostDisplay } from "@/components/community/community-post-display";
import { ActionButton, ConfirmActionPanel, DetailHeader, EmptyState, PageContainer } from "@/components/ui/app-ui";

type LeaderCommunityUpdatesPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeaderCommunityUpdatesPage({ params }: LeaderCommunityUpdatesPageProps) {
  const { id } = await params;
  const data = await getCommunityPostsForLeader(id);

  if (!data.community) {
    notFound();
  }

  return (
    <PageContainer>
      <DetailHeader
        backHref={`/leader/communities/${id}`}
        backLabel="Back to management"
        eyebrow="Official content"
        title="Community updates"
        description={<>Publish official updates, links, images, and videos for {data.community.name}.</>}
        action={<ActionButton href={`/leader/communities/${id}/updates/new`}>New update</ActionButton>}
      />

      <div className="mt-10 grid gap-5">
          {data.posts.length === 0 ? (
            <EmptyState icon={Megaphone} title="No updates yet" description="Share the first official announcement, image, video, or link for this existing community page." />
          ) : (
            data.posts.map((post) => (
              <div key={post.id} className="space-y-3">
                <CommunityPostDisplay post={post} editHref={`/leader/communities/${id}/updates/${post.id}/edit`} />
                <ConfirmActionPanel
                  action={deleteCommunityPost}
                  hiddenFields={{ post_id: post.id, community_id: id, return_to: `/leader/communities/${id}/updates` }}
                  title="Delete this official update"
                  description="This removes the update from the public community page."
                  actionLabel="Delete update"
                  confirmationId={`delete-update-${post.id}`}
                />
              </div>
            ))
          )}
      </div>
    </PageContainer>
  );
}
