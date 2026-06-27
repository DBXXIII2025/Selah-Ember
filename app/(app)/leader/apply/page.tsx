import { ActionButton, ContentCard, PageContainer, PageHeader } from "@/components/ui/app-ui";

export default function LeaderApplyPage() {
  return (
    <PageContainer size="medium">
      <PageHeader
        eyebrow="Open participation"
        title="Role applications are no longer required"
        description="Anyone who signs in can post to the community feed, ask for prayer, create groups, and join group discussions."
      />
      <ContentCard as="section" className="mt-8 p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Start participating</h2>
        <p className="mt-3 leading-7 text-[#67564c]">No special community role or verification workflow is needed.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ActionButton href="/community">Open community</ActionButton>
          <ActionButton href="/groups/new" variant="secondary">Create group</ActionButton>
        </div>
      </ContentCard>
    </PageContainer>
  );
}
