import { ProfileForm } from "@/components/profile/profile-form";
import { getCurrentUserProfile } from "@/app/actions/profile";

type ProfilePageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [profile, params] = await Promise.all([getCurrentUserProfile(), searchParams]);

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
          Personal fellowship profile
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Profile</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
          Shape the profile your community will eventually see across prayer, groups, and church life.
        </p>

        <div className="mt-10">
          <ProfileForm profile={profile} message={params.message} />
        </div>
      </div>
    </section>
  );
}
