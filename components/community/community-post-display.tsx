import Link from "next/link";
import { CommunityPostReactions } from "@/components/community/community-post-reactions";
import { SafeLink } from "@/components/media/safe-link";
import type { CommunityPost } from "@/app/actions/community-posts";
import { toggleCommunityPostPin } from "@/app/actions/community-posts";

type CommunityPostDisplayProps = {
  post: CommunityPost;
  href?: string | null;
  editHref?: string | null;
  compact?: boolean;
  pinReturnTo?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function wasEdited(post: CommunityPost) {
  return Math.abs(new Date(post.updated_at).getTime() - new Date(post.created_at).getTime()) > 1000;
}


function Media({ post }: Readonly<{ post: CommunityPost }>) {
  if (post.media_kind === "link" && post.media_url) {
    return (
      <div className="rounded-xl border border-[#ead6c5] bg-[#fffaf4] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#715e54]">Link</p>
        <SafeLink
          href={post.media_url}
          className="mt-2 block break-all text-sm font-semibold text-[#8a3f1e] transition hover:text-[#b94f22]"
        >
          {post.media_url}
        </SafeLink>
      </div>
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

export function CommunityPostDisplay({ post, href, editHref, compact = false, pinReturnTo = "/community/browse" }: Readonly<CommunityPostDisplayProps>) {
  const title = post.title || "Community post";

  return (
    <article className="rounded-2xl border border-[#ead6c5] bg-white/80 p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex gap-3">
          <Link href={post.author_profile_id ? `/members/${post.author_profile_id}` : "#"} aria-label={`View ${post.author_name || "member"}'s profile`} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#ffe2cb] text-sm font-semibold text-[#8a3f1e]">
            {post.author_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.author_avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (post.author_name || "Member").slice(0, 1).toUpperCase()
            )}
          </Link>
          <div>
            <Link href={post.author_profile_id ? `/members/${post.author_profile_id}` : "#"} className="text-sm font-semibold text-[#3b312b] hover:text-[#a94720]">{post.author_name || "Member"}</Link>
            {post.author_username ? <span className="ml-2 text-xs text-[#715e54]">@{post.author_username}</span> : null}
            <p className="mt-1 text-xs text-[#715e54]">
              {formatDate(post.created_at)}
              {wasEdited(post) ? " - edited" : ""}
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
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
        {post.is_pinned ? <span className="rounded-full bg-[#ffe2cb] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#8a3f1e]">Pinned</span> : null}
        {editHref ? (
          <Link
            href={editHref}
            className="inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
          >
            Edit
          </Link>
        ) : null}
        </div>
      </div>

      {post.body ? <p className="mt-4 whitespace-pre-wrap leading-7 text-[#3b312b]">{post.body}</p> : null}
      {post.topics.length ? <div className="mt-4 flex flex-wrap gap-2">{post.topics.map((topic) => <Link key={topic.slug} href={`/community/browse?topic=${encodeURIComponent(topic.slug)}`} className="rounded-full bg-[#fff4e8] px-3 py-1 text-xs font-semibold text-[#8a3f1e]">{topic.name}</Link>)}</div> : <Link href="/community/browse?topic=general" className="mt-4 inline-flex rounded-full bg-[#fff4e8] px-3 py-1 text-xs font-semibold text-[#8a3f1e]">General Community</Link>}
      <div className="mt-4">
        <Media post={post} />
      </div>
      {post.deleted_at ? <p className="mt-4 text-sm font-semibold text-[#8a3f1e]">Deleted</p> : null}
      {!post.is_published ? <p className="mt-4 text-sm font-semibold text-[#8a3f1e]">Draft</p> : null}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <CommunityPostReactions
          postId={post.id}
          counts={post.reaction_counts}
          selected={post.viewer_reactions}
          returnTo={href || `/community/posts/${post.id}`}
        />
        {href ? (
          <Link href={href} className="inline-flex h-9 items-center rounded-full border border-[#2f2722]/15 px-3 text-sm font-semibold text-[#8a3f1e] hover:bg-[#fff4e8]">
            {post.comment_count === 1 ? "1 comment" : `${post.comment_count} comments`}
          </Link>
        ) : (
          <span className="inline-flex h-9 items-center rounded-full border border-[#2f2722]/15 px-3 text-sm font-semibold text-[#67564c]">
            {post.comment_count === 1 ? "1 comment" : `${post.comment_count} comments`}
          </span>
        )}
      </div>
      {post.can_pin ? <form action={toggleCommunityPostPin} className="mt-4"><input type="hidden" name="post_id" value={post.id} /><input type="hidden" name="return_to" value={pinReturnTo} /><button className="text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">{post.is_pinned ? "Unpin" : "Pin"} post</button></form> : null}
    </article>
  );
}
