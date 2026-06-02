import Link from "next/link";
import { SafeLink } from "@/components/media/safe-link";
import type { CommunityPost } from "@/app/actions/community-posts";

type CommunityPostDisplayProps = {
  post: CommunityPost;
  href?: string | null;
  editHref?: string | null;
  compact?: boolean;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function Media({ post }: Readonly<{ post: CommunityPost }>) {
  if (post.media_kind === "link" && post.media_url) {
    return (
      <SafeLink
        href={post.media_url}
        className="inline-flex break-all rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
      >
        Open link
      </SafeLink>
    );
  }

  if (post.media_kind === "image" && post.signed_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={post.signed_url} alt="" className="mt-4 max-h-[32rem] w-full rounded-xl object-cover" />;
  }

  if (post.media_kind === "video" && post.signed_url) {
    return (
      <video
        controls
        preload="metadata"
        src={post.signed_url}
        className="mt-4 max-h-[32rem] w-full rounded-xl border border-[#ead6c5]"
      />
    );
  }

  return null;
}

export function CommunityPostDisplay({ post, href, editHref, compact = false }: Readonly<CommunityPostDisplayProps>) {
  const title = post.title || "Community post";

  return (
    <article className="rounded-2xl border border-[#ead6c5] bg-white/75 p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
            {post.author_name ? `Posted by ${post.author_name}` : "Community post"}
          </p>
          {post.title ? (
            href ? (
              <Link href={href} className="inline-flex">
                <h2 className={`mt-3 font-semibold transition hover:text-[#b94f22] ${compact ? "text-xl" : "text-2xl"}`}>
                  {title}
                </h2>
              </Link>
            ) : (
              <h2 className={`mt-3 font-semibold ${compact ? "text-xl" : "text-2xl"}`}>{title}</h2>
            )
          ) : null}
          <p className="mt-2 text-sm text-[#8a7467]">{formatDate(post.created_at)}</p>
        </div>
        {editHref ? (
          <Link
            href={editHref}
            className="inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
          >
            Edit
          </Link>
        ) : null}
      </div>

      {post.body ? <p className="mt-4 whitespace-pre-wrap leading-7 text-[#3b312b]">{post.body}</p> : null}
      <div className="mt-4">
        <Media post={post} />
      </div>
      {post.deleted_at ? <p className="mt-4 text-sm font-semibold text-[#8a3f1e]">Deleted</p> : null}
      {!post.is_published ? <p className="mt-4 text-sm font-semibold text-[#8a3f1e]">Draft</p> : null}
      {href ? (
        <Link href={href} className="mt-4 inline-flex text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          {post.comment_count === 1 ? "1 comment" : `${post.comment_count} comments`}
        </Link>
      ) : null}
    </article>
  );
}
