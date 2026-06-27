import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { getPlatformMessagesData, startPlatformSupportConversation } from "@/app/actions/platform";
import {
  ActionButton,
  Badge,
  ContentCard,
  DetailHeader,
  EmptyState,
  FormNotice,
  PageContainer,
  SearchInput,
  SectionHeader,
} from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";

type PlatformMessagesPageProps = {
  searchParams: Promise<{
    q?: string;
    message?: string;
  }>;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function conversationTitle(conversation: Awaited<ReturnType<typeof getPlatformMessagesData>>["conversations"][number]) {
  const others = conversation.participants.filter(
    (participant) => participant.user_id !== conversation.current_user_id,
  );

  return others.map((participant) => participant.display_name).join(", ") || "Direct message";
}

export default async function PlatformMessagesPage({ searchParams }: PlatformMessagesPageProps) {
  const params = await searchParams;
  const data = await getPlatformMessagesData(params.q || "");

  return (
    <PageContainer>
      <DetailHeader
        backHref="/platform"
        backLabel="Back to platform"
        eyebrow="Platform messages"
        title="Support conversations"
        description="Message users directly while keeping the normal user inbox and notifications intact."
      />

        {params.message ? (
          <FormNotice className="mt-6">{params.message}</FormNotice>
        ) : null}

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <ContentCard as="section" className="bg-white/70">
            <SectionHeader title={<span className="flex items-center gap-3"><MessageCircle aria-hidden="true" className="h-5 w-5 text-[#b94f22]" />Inbox</span>} />
            {data.conversations.length === 0 ? (
              <EmptyState className="mt-6" icon={MessageCircle} title="No support conversations yet" description="Search for a user and start the first conversation." />
            ) : (
              <div className="mt-6 space-y-4">
                {data.conversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/platform/messages/${conversation.id}`}
                    className="block rounded-2xl border border-[#ead6c5] bg-white/75 p-5 shadow-sm transition hover:border-[#d79568] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#cf5f2b]/20"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-semibold">{conversationTitle(conversation)}</h3>
                          {conversation.unread_count > 0 ? (
                            <Badge tone="solid">{conversation.unread_count} unread</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-[#67564c]">
                          {conversation.latest_message
                            ? conversation.latest_message.deleted_at
                              ? "Message deleted"
                              : conversation.latest_message.body
                            : "No messages yet"}
                        </p>
                      </div>
                      <p className="text-sm text-[#8a3f1e]">{formatDate(conversation.updated_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ContentCard>

          <ContentCard as="section" className="h-fit bg-white/70">
            <SectionHeader title="Start conversation" description="Find a user before opening a support thread." />
            <form className="mt-5">
              <SearchInput name="q" defaultValue={params.q || ""} label="Search users" placeholder="Search users" />
              <ActionButton type="submit" className="mt-4">Search</ActionButton>
            </form>

            <div className="mt-6 space-y-3">
              {data.users.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#d79568] bg-white/65 p-4 text-sm text-[#67564c]">
                  No users found.
                </p>
              ) : (
                data.users.map((user) => (
                  <ContentCard key={user.user_id} className="rounded-xl bg-white/80 p-4 text-sm">
                    <p className="font-semibold">{user.display_name}</p>
                    <p className="mt-1 break-words text-[#67564c]">
                      {user.username ? `@${user.username}` : "No username"}
                      {user.email ? ` - ${user.email}` : ""}
                    </p>
                    <p className="mt-1 text-[#8a3f1e]">
                      {user.role}
                      {user.active_ban ? " - banned" : ""}
                    </p>
                    <form action={startPlatformSupportConversation} className="mt-3">
                      <input type="hidden" name="target_user_id" value={user.user_id} />
                      <SubmitButton pendingLabel="Opening…" className="px-4 py-2">Message</SubmitButton>
                    </form>
                  </ContentCard>
                ))
              )}
            </div>
          </ContentCard>
        </div>
    </PageContainer>
  );
}
