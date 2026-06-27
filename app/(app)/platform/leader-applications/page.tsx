import { requirePlatformEngineer } from "@/lib/platform/auth";
import { ActionButton, ContentCard, PageContainer, PageHeader } from "@/components/ui/app-ui";

export default async function PlatformLeaderApplicationsPage() {
  await requirePlatformEngineer();

  return (
    <PageContainer size="medium">
      <PageHeader
        eyebrow="Retired workflow"
        title="Leader applications are no longer used"
        description="Selah Ember uses an open community model with user and platform_engineer roles only."
      />
      <ContentCard as="section" className="mt-8">
        <p className="leading-7 text-[#67564c]">This route remains available only as a clear transition notice for existing links.</p>
        <ActionButton href="/platform" className="mt-6">Back to platform</ActionButton>
      </ContentCard>
    </PageContainer>
  );
}
