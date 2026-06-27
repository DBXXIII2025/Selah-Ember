import { HeartHandshake, MessageCircle, MessagesSquare, UsersRound } from "lucide-react";
import { ActionButton, PageContainer, PageHeader, StatCard } from "@/components/ui/app-ui";
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
    <PageContainer>
      <PageHeader
        eyebrow="Welcome"
        title={<>Selah Ember is ready, {user?.email}</>}
        description="Begin with the community feed, then move into prayer, groups, messages, and events as you connect."
      />
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ActionButton href="/community">Start in the community</ActionButton>
        <ActionButton href="/profile" variant="secondary">Edit profile</ActionButton>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map((card) => (
          <StatCard
            key={card.title}
            icon={card.icon}
            title={card.title}
            description={card.body}
            action={<ActionButton href={card.href} variant="quiet" size="sm" className="-ml-4">{card.cta}</ActionButton>}
          />
        ))}
      </div>
    </PageContainer>
  );
}
