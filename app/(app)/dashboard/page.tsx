import { CalendarDays, Flame, HeartHandshake, UsersRound } from "lucide-react";
import Link from "next/link";
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
    body: "Post encouragement, updates, safe links, images, and comments in the open community feed.",
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
          Join the open Selah Ember community, pray with others, create Bible study groups, message friends, and stay connected.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/profile"
            className="inline-flex items-center justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
          >
            Edit profile
          </Link>
          <Link
            href="/community"
            className="inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 bg-white/70 px-5 py-3 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
          >
            Open community
          </Link>
          <Link
            href="/prayer"
            className="inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 bg-white/70 px-5 py-3 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
          >
            View prayer
          </Link>
          <Link
            href="/groups"
            className="inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 bg-white/70 px-5 py-3 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
          >
            View groups
          </Link>
          <Link
            href="/events"
            className="inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 bg-white/70 px-5 py-3 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
          >
            View events
          </Link>
        </div>

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
