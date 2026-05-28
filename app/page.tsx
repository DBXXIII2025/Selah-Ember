import { CalendarDays, Flame, HeartHandshake, UsersRound } from "lucide-react";

const fellowshipPillars = [
  {
    title: "Prayer",
    description: "Share requests, gather intercessors, and keep care visible within trusted communities.",
    icon: Flame,
  },
  {
    title: "Bible Study Groups",
    description: "Create spaces for study rhythms, discussion, and discipleship across every season.",
    icon: UsersRound,
  },
  {
    title: "Church Events",
    description: "Bring worship nights, service opportunities, and local gatherings into one peaceful calendar.",
    icon: CalendarDays,
  },
  {
    title: "Community",
    description: "Help believers find fellowship, encouragement, and a place to belong beyond Sunday.",
    icon: HeartHandshake,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fff8ed] text-[#211b17]">
      <section className="relative isolate flex min-h-screen items-center px-6 py-16 sm:px-10 lg:px-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(229,111,44,0.18),transparent_32%),linear-gradient(135deg,#fff8ed_0%,#f4dcc0_48%,#2a211d_100%)]" />
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex rounded-full border border-[#d79568]/50 bg-white/55 px-4 py-2 text-sm font-medium text-[#8a3f1e] shadow-sm backdrop-blur">
              Selah Ember
            </p>
            <h1 className="text-5xl font-semibold tracking-normal text-[#211b17] sm:text-6xl lg:text-7xl">
              Digital fellowship for churches, groups, and believers
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#594a42] sm:text-xl">
              A warm, modern home for prayer, study, events, and community life, built to help Christian fellowship feel close and cared for.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href="#"
                className="inline-flex items-center justify-center rounded-full bg-[#cf5f2b] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-[#cf5f2b]/25 transition hover:bg-[#b94f22]"
              >
                Create Community
              </a>
              <a
                href="#groups"
                className="inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 bg-white/70 px-6 py-3 text-base font-semibold text-[#2f2722] shadow-sm backdrop-blur transition hover:bg-white"
              >
                Explore Groups
              </a>
            </div>
          </div>

          <div className="relative rounded-[2rem] border border-white/45 bg-[#211b17]/90 p-8 text-[#fff8ed] shadow-2xl shadow-[#3b2117]/30">
            <div className="absolute right-8 top-8 h-16 w-16 rounded-full bg-[#e56f2c]/30 blur-xl" />
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[#f1b181]">
              Fellowship rhythm
            </p>
            <div className="mt-10 space-y-6">
              <div>
                <p className="text-4xl font-semibold">Prayer circle</p>
                <p className="mt-3 text-[#ead6c5]">
                  Requests, praises, and pastoral care gathered in a quiet shared space.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-2xl font-semibold">12</p>
                  <p className="mt-1 text-sm text-[#ead6c5]">Groups forming</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-2xl font-semibold">4</p>
                  <p className="mt-1 text-sm text-[#ead6c5]">Events this week</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="groups" className="px-6 py-20 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
              Gather with intention
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-[#211b17] sm:text-4xl">
              A foundation for shared spiritual life
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {fellowshipPillars.map((pillar) => {
              const Icon = pillar.icon;

              return (
                <article
                  key={pillar.title}
                  className="rounded-2xl border border-[#ead6c5] bg-white/70 p-6 shadow-sm"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-[#211b17]">{pillar.title}</h3>
                  <p className="mt-3 leading-7 text-[#67564c]">{pillar.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
