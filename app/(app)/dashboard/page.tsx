import { HeartHandshake, MessageCircle, MessagesSquare, UsersRound } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const dashboardCards = [
  {
    title: "Start in the community",
    body: "Read the latest posts, share encouragement, and respond to others in the open Selah Ember feed.",
    href: "/community",
    cta: "Open community",
    icon: HeartHandshake,
  },
  {
    title: "Ask for prayer",
    body: "Create a prayer request or pray through what others have shared.",
    href: "/prayer",
    cta: "Open prayer",
    icon: MessageCircle,
  },
  {
    title: "Join a group",
    body: "Find or create a Bible study group for structured discussion and fellowship.",
    href: "/groups",
    cta: "Open groups",
    icon: UsersRound,
  },
  {
    title: "Message someone",
    body: "Start a direct conversation and stay connected outside the feed.",
    href: "/messages",
    cta: "Open messages",
    icon: MessagesSquare,
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
          Welcome
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Selah Ember is ready, {user?.email}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
          Begin with the community feed, then move into prayer, groups, messages, and events as you connect.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/community"
            className="inline-flex items-center justify-center rounded-full bg-[#cf5f2b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
          >
            Start in the community
          </Link>
          <Link
            href="/profile"
            className="inline-flex items-center justify-center rounded-full border border-[#2f2722]/20 bg-white/70 px-5 py-3 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
          >
            Edit profile
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
                <Link href={card.href} className="mt-5 inline-flex text-sm font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
                  {card.cta}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
