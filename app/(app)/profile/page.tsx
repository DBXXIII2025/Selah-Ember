import { ProfileForm } from "@/components/profile/profile-form";
import { getCurrentUserProfile } from "@/app/actions/profile";
import { PageContainer, PageHeader } from "@/components/ui/app-ui";

type ProfilePageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [profile, params] = await Promise.all([getCurrentUserProfile(), searchParams]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Personal fellowship profile"
        title="Profile"
        description="Shape the profile others see across prayer, groups, and community life."
      />

      <div className="mt-10">
        <ProfileForm profile={profile} message={params.message} />
      </div>
    </PageContainer>
  );
}
