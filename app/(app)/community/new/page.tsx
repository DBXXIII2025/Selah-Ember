import Link from "next/link";
import { createOpenCommunityPost, getDefaultCommunity } from "@/app/actions/community-posts";
import { CommunityPostForm } from "@/components/community/community-post-form";

type NewCommunityPostPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function NewCommunityPostPage({ searchParams }: NewCommunityPostPageProps) {
  const [community, params] = await Promise.all([getDefaultCommunity(), searchParams]);

  return (
    <section className="px-6 py-10 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/community" className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Back to community
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">New post</p>
        <h1 className="mt-3 text-4xl font-semibold">Share with the community</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[#67564c]">
          Post text, safe links, images, or videos. Video requires manual play controls.
        </p>

        {params.message ? (
          <div className="mt-6 rounded-xl border border-[#ead6c5] bg-white/80 p-4 text-sm text-[#67564c]">
            {params.message}
          </div>
        ) : null}

        {!community ? (
          <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            Posting is temporarily unavailable while the community feed finishes setup.
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
            <CommunityPostForm
              action={createOpenCommunityPost}
              communityId={community.id}
              returnTo="/community/new"
              submitLabel="Post"
              showPublishToggle={false}
            />
          </div>
        )}
      </div>
    </section>
  );
}
