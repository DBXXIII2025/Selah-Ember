import { ActionButton, DetailHeader, FormShell, PageContainer } from "@/components/ui/app-ui";

export default function NewCommunityPage() {
  return (
    <PageContainer size="medium">
      <DetailHeader
        backHref="/communities"
        backLabel="Back to communities"
        eyebrow="Open community"
        title="One community, open to everyone"
        description="Selah Ember centers one shared faith community rather than separate organization-managed spaces."
      />
      <FormShell
        className="mt-10"
        title="Choose where to begin"
        description="Post in the open community feed, or create a Bible study group when you need a focused space for ongoing fellowship."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionButton href="/community">Open community</ActionButton>
          <ActionButton href="/groups/new" variant="secondary">Create group</ActionButton>
        </div>
      </FormShell>
    </PageContainer>
  );
}
