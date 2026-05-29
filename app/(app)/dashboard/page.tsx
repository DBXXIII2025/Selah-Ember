import { CalendarDays, Flame, HeartHandshake, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const dashboardCards = [
  {
    title: "Prayer",
    body: "Collect and care for prayer requests as your community gathers.",
    icon: Flame,
  },
  {
    title: "Groups",
    body: "Prepare Bible study spaces for discipleship and fellowship.",
    icon: UsersRound,
  },
  {
    title: "Events",
    body: "Keep church gatherings and community moments easy to find.",
    icon: CalendarDays,
  },
  {
    title: "Community",
    body: "Shape a peaceful member home before deeper features arrive.",
    icon: HeartHandshake,
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
          Protected fellowship space
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Welcome, {user?.email}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
          This is the first protected Selah Ember area. Auth is wired, profiles are created, and the next phase can build real community workflows here.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {dashboardCards.map((card) => {
            const Icon = card.icon;

            return (
              <article key={card.title} className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </div>
                <h2 className="mt-6 text-xl font-semibold">{card.title}</h2>
                <p className="mt-3 leading-7 text-[#67564c]">{card.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
