import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommunityMembershipStatus, getPublicCommunityBySlug } from "@/app/actions/communities";
import { getCommunityMedia } from "@/app/actions/media";
import { MediaItemDisplay } from "@/components/media/media-item-display";
import { BrandMark } from "@/components/ui/brand-mark";

type CommunityMediaPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function CommunityMediaPage({ params }: CommunityMediaPageProps) {
  const { slug } = await params;
  const community = await getPublicCommunityBySlug(slug);

  if (!community) {
    notFound();
  }

  const [media, status] = await Promise.all([
    getCommunityMedia(slug),
    getCommunityMembershipStatus(community.id),
  ]);

  return (
    <main className="min-h-screen bg-[#f7ead7] text-[#211814]">
      <section className="relative isolate px-6 py-10 sm:px-10 lg:px-16">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,#f7ead7_0%,#ead0ac_50%,#151210_100%)]" />
        <nav className="mx-auto flex max-w-7xl items-center justify-between">
          <BrandMark />
          <div className="flex items-center gap-4 text-sm font-semibold">
            <Link href={`/c/${slug}`} className="text-[#67564c] hover:text-[#b94f22]">
              Back to community
            </Link>
            {status.isOwner ? (
              <Link href={`/leader/communities/${community.id}/media`} className="text-[#8a3f1e] hover:text-[#b94f22]">
                Manage media
              </Link>
            ) : null}
          </div>
        </nav>

        <div className="mx-auto mt-14 max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8a3f1e]">Media Library</p>
          <h1 className="mt-4 text-5xl font-semibold sm:text-6xl">{community.name}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#594a42]">
            Published sermons, teachings, testimonies, and resource links.
          </p>

          <div className="mt-10 grid gap-5">
            {media.items.length === 0 ? (
              <div className="rounded-2xl border border-white/55 bg-white/65 p-8 text-center shadow-sm">
                <h2 className="text-2xl font-semibold">No published media yet</h2>
                <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
                  Check back later for sermons, teachings, notes, and links shared by this community.
                </p>
              </div>
            ) : (
              media.items.map((item) => (
                <MediaItemDisplay
                  key={item.id}
                  item={item}
                  href={`/c/${slug}/media/${item.id}`}
                  compact
                />
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
