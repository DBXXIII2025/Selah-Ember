import { LoadingState, PageContainer, PageHeader } from "@/components/ui/app-ui";

export default function AppLoading() {
  return (
    <PageContainer size="medium">
      <PageHeader
        eyebrow="Selah Ember"
        title="Gathering this space"
        description="Loading the latest community activity."
      />
      <LoadingState className="mt-10" />
    </PageContainer>
  );
}
