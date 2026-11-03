import { CalendarDays, Flame, HeartHandshake, UsersRound } from "lucide-react";
import Image from "next/image";
import { BrandMark } from "@/components/ui/brand-mark";

type HomeProps = {
  searchParams?: Promise<{
    message?: string;
  }>;
};

const fellowshipPillars = [
  {
    title: "Prayer",
    description: "Share requests, gather intercessors, and keep care visible within trusted communities.",
    icon: Flame,
  },
  {
    title: "Bible Study Groups",
    description: "Create Bible study groups for study rhythms, discussion, and discipleship across every season.",
    icon: UsersRound,
  },
  {
    title: "Faith Events",
    description: "Bring worship nights, service opportunities, and community gatherings into one peaceful calendar.",
    icon: CalendarDays,
  },
  {
    title: "Community",
    description: "Help believers find fellowship, encouragement, and a place to belong beyond Sunday.",
    icon: HeartHandshake,
  },
];

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const message = params?.message;

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7ead7] text-[#211814]">
      <section className="relative isolate flex items-center bg-[#151210] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <Image
          src="/images/selah-ember-logo.png"
          alt=""
          fill
          sizes="100vw"
          className="absolute inset-0 -z-10 object-cover opacity-18 mix-blend-screen"
          priority
        />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_22%_24%,rgba(217,120,52,0.3),transparent_30%),linear-gradient(90deg,rgba(21,18,16,0.98)_0%,rgba(21,18,16,0.86)_46%,rgba(21,18,16,0.58)_100%)]" />
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)] lg:items-center lg:gap-16">
          <div className="max-w-2xl">
            <BrandMark variant="light" />
            {message ? (
              <div role="status" className="mt-8 inline-flex rounded-full border border-[#d8965c]/45 bg-[#fff4df]/12 px-4 py-2 text-sm font-semibold text-[#fff4df]">
                {message}
              </div>
            ) : null}
            <h1 className="mt-8 max-w-2xl font-serif text-[clamp(2.65rem,5vw,4.6rem)] font-semibold leading-[1.06] tracking-[-0.045em] text-[#fff4df]">
              An open faith community for prayer, groups, and fellowship
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#e8ccb0] sm:text-lg">
              A warm, modern home for encouragement, prayer, Bible study, events, and meaningful connection.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/signup"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#a94720] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-[#a94720]/25 transition hover:bg-[#8f3518]"
              >
                Join Community
              </a>
              <a
                href="/discover"
                className="inline-flex items-center justify-center rounded-full border border-[#c8874d]/45 bg-[#fff4df]/10 px-6 py-3 text-base font-semibold text-[#fff4df] shadow-sm backdrop-blur transition hover:bg-[#fff4df]/18"
              >
                Discover Groups
              </a>
            </div>
          </div>

          <div className="relative rounded-3xl border border-[#c8874d]/35 bg-[#211814]/82 p-6 sm:p-8 text-[#fff4df] shadow-2xl shadow-black/40 backdrop-blur">
            <div className="absolute right-8 top-8 h-16 w-16 rounded-full bg-[#d97834]/30 blur-xl" />
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[#d8965c]">
              Fellowship rhythm
            </p>
            <div className="mt-10">
              <div>
                <p className="font-serif text-4xl font-semibold">Prayer circle</p>
                <p className="mt-3 text-[#ead6c5]">
                  Requests, praises, and prayerful care gathered in a quiet shared space.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="groups" className="bg-[#f7ead7] px-5 py-14 sm:px-8 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9b4d25]">
              Gather with intention
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-[#211814] sm:text-4xl">
              A foundation for shared spiritual life
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {fellowshipPillars.map((pillar) => {
              const Icon = pillar.icon;

              return (
                <article
                  key={pillar.title}
                  className="rounded-2xl border border-[#d9b58d] bg-[#fff8ed]/80 p-5 shadow-[0_12px_32px_rgba(33,24,20,0.07)] transition duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[#211b17]">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#67564c]">{pillar.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
