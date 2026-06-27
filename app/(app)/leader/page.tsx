import { ActionButton, ContentCard, PageContainer, PageHeader } from "@/components/ui/app-ui";

export default function LeaderPage() {
  return (
    <PageContainer size="medium">
      <PageHeader
        eyebrow="Open community"
        title="Community participation is open"
        description="Selah Ember centers one open community feed plus user-created groups. Platform engineers manage moderation and official platform content."
      />
      <ContentCard as="section" className="mt-8 p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Choose where to contribute</h2>
        <p className="mt-3 leading-7 text-[#67564c]">Share with the whole community or create a focused Bible study group.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ActionButton href="/community">Open community</ActionButton>
          <ActionButton href="/groups/new" variant="secondary">Create group</ActionButton>
        </div>
      </ContentCard>
    </PageContainer>
  );
}
