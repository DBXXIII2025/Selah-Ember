import Link from "next/link";
import { SafeLink } from "@/components/media/safe-link";
import { contentKindLabel, mediaTypeLabel } from "@/lib/media/library";
import type { MediaItem } from "@/app/actions/media";

type MediaItemDisplayProps = {
  item: MediaItem;
  href?: string;
  manageHref?: string | null;
  showCommunity?: boolean;
  compact?: boolean;
};

function MediaSource({ item }: Readonly<{ item: MediaItem }>) {
  if (item.content_kind === "text") {
    return null;
  }

  if (item.external_url) {
    return (
      <SafeLink
        href={item.external_url}
        className="inline-flex break-all rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
      >
        Open source link
      </SafeLink>
    );
  }

  if (!item.signed_url) {
    return (
      <p className="text-sm text-[#67564c]">
        {item.content_kind === "audio"
          ? "Audio unavailable."
          : item.content_kind === "video"
            ? "Video unavailable."
            : "Document unavailable."}
      </p>
    );
  }

  if (item.content_kind === "audio") {
    return <audio controls preload="metadata" src={item.signed_url} className="mt-4 w-full" />;
  }

  if (item.content_kind === "video") {
    return (
      <video
        controls
        preload="metadata"
        src={item.signed_url}
        className="mt-4 max-h-[32rem] w-full rounded-xl border border-[#ead6c5]"
      />
    );
  }

  return (
    <SafeLink
      href={item.signed_url}
      className="inline-flex break-all rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
    >
      {item.file_name || "Open document"}
    </SafeLink>
  );
}

export function MediaItemDisplay({
  item,
  href,
  manageHref,
  showCommunity = false,
  compact = false,
}: Readonly<MediaItemDisplayProps>) {
  const className = "overflow-hidden rounded-2xl border border-[#ead6c5] bg-white/75 p-5 shadow-sm transition hover:border-[#cf5f2b]/30 hover:shadow-md";

  return (
    <article className={className}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
            <span>{mediaTypeLabel(item.media_type)}</span>
            <span>·</span>
            <span>{contentKindLabel(item.content_kind)}</span>
          </div>
          {href ? (
            <Link href={href} className={`mt-3 block font-semibold hover:text-[#b94f22] ${compact ? "text-xl" : "text-2xl"}`}>
              {item.title}
            </Link>
          ) : (
            <h2 className={`mt-3 font-semibold ${compact ? "text-xl" : "text-2xl"}`}>{item.title}</h2>
          )}
          {showCommunity ? <p className="mt-2 text-sm text-[#67564c]">{item.community.name}</p> : null}
        </div>
        {manageHref ? (
          <Link
            href={manageHref}
            className="inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
          >
            Manage
          </Link>
        ) : null}
      </div>

      {item.scripture_reference ? (
        <p className="mt-4 text-sm font-semibold text-[#8a3f1e]">{item.scripture_reference}</p>
      ) : null}
      {item.speaker_name ? <p className="mt-1 text-sm text-[#67564c]">Speaker: {item.speaker_name}</p> : null}
      {item.description ? (
        <p className="mt-4 whitespace-pre-wrap leading-7 text-[#3b312b]">{item.description}</p>
      ) : null}

      <div className="mt-4">
        <MediaSource item={item} />
      </div>

      {item.deleted_at ? <p className="mt-4 text-sm font-semibold text-[#8a3f1e]">Deleted</p> : null}
    </article>
  );
}
