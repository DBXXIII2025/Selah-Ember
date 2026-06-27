import { Search } from "lucide-react";
import { searchMessageUsers, startDirectConversation } from "@/app/actions/messages";
import { ActionButton, ContentCard, DetailHeader, EmptyState, FormNotice, PageContainer, SearchInput } from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";

type NewMessagePageProps = {
  searchParams: Promise<{
    q?: string;
    message?: string;
  }>;
};

export default async function NewMessagePage({ searchParams }: NewMessagePageProps) {
  const params = await searchParams;
  const users = await searchMessageUsers(params.q || "");

  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref="/messages"
        backLabel="Back to messages"
        eyebrow="New message"
        title="Choose a person"
        description="Search visible profiles and start a private one-on-one conversation."
      />

        {params.message ? (
          <FormNotice className="mt-6">{params.message}</FormNotice>
        ) : null}

        <ContentCard as="section" className="mt-10 bg-white/70">
          <form>
            <SearchInput name="q" defaultValue={params.q || ""} label="Search people" placeholder="Search by name or username" />
            <ActionButton type="submit" className="mt-4">Search</ActionButton>
          </form>
        </ContentCard>

        <div className="mt-8 space-y-4">
          {users.length === 0 ? (
            <EmptyState icon={Search} title="No people found" description="Try a display name, username, or optional faith-community name." />
          ) : (
            users.map((user) => (
              <ContentCard key={user.user_id} className="bg-white/70">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-xl font-semibold">{user.display_name}</h2>
                    <p className="mt-1 text-sm text-[#67564c]">
                      {user.username ? `@${user.username}` : "No username"}
                      {user.church_name ? ` - ${user.church_name}` : ""}
                    </p>
                  </div>
                  <form action={startDirectConversation}>
                    <input type="hidden" name="target_user_id" value={user.user_id} />
                    <SubmitButton pendingLabel="Opening…">Message</SubmitButton>
                  </form>
                </div>
              </ContentCard>
            ))
          )}
        </div>
    </PageContainer>
  );
}
