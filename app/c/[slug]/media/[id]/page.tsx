import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommunityMembershipStatus, getPublicCommunityBySlug } from "@/app/actions/communities";
import { getMediaItem } from "@/app/actions/media";
import { MediaItemDisplay } from "@/components/media/media-item-display";
import { BrandMark } from "@/components/ui/brand-mark";

type CommunityMediaItemPageProps = {
  params: Promise<{
    slug: string;
    id: string;
  }>;
};

export default async function CommunityMediaItemPage({ params }: CommunityMediaItemPageProps) {
  const { slug, id } = await params;
  const community = await getPublicCommunityBySlug(slug);

  if (!community) {
    notFound();
  }

  const [media, status] = await Promise.all([
    getMediaItem(slug, id),
    getCommunityMembershipStatus(community.id),
  ]);

  if (!media.item) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7ead7] text-[#211814]">
      <section className="relative isolate px-6 py-10 sm:px-10 lg:px-16">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,#f7ead7_0%,#ead0ac_50%,#151210_100%)]" />
        <nav className="mx-auto flex max-w-7xl items-center justify-between">
          <BrandMark />
          <div className="flex items-center gap-4 text-sm font-semibold">
            <Link href={`/c/${slug}/media`} className="text-[#67564c] hover:text-[#b94f22]">
              Back to media
            </Link>
            {status.isOwner ? (
              <Link href={`/leader/communities/${community.id}/media`} className="text-[#8a3f1e] hover:text-[#b94f22]">
                Manage media
              </Link>
            ) : null}
          </div>
        </nav>

        <div className="mx-auto mt-14 max-w-5xl">
          <MediaItemDisplay item={media.item} />
        </div>
      </section>
    </main>
  );
}
