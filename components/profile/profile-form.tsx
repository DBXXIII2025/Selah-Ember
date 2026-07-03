import {
  updateCurrentUserProfile,
  uploadCurrentUserAvatar,
  type CurrentUserProfile,
} from "@/app/actions/profile";
import {
  DetailHero,
  FormActions,
  FormField,
  FormHint,
  FormLabel,
  FormNotice,
  FormSection,
  FormShell,
  formControlClassName,
} from "@/components/ui/app-ui";
import { SubmitButton } from "@/components/ui/submit-button";

type ProfileFormProps = {
  profile: CurrentUserProfile;
  message?: string;
};

function EmptyValue({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-[#9a8172]">{children}</span>;
}

export function ProfileForm({ profile, message }: ProfileFormProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <aside>
        <DetailHero>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
          Your profile
        </p>
        <div className="mt-6 flex items-center gap-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-16 w-16 rounded-full border border-[#ead6c5] object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ffe2cb] text-2xl font-semibold text-[#b94f22]">
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-semibold">{profile.display_name}</h2>
            <p className="mt-1 text-sm text-[#67564c]">
              {profile.username ? `@${profile.username}` : <EmptyValue>Add a username</EmptyValue>}
            </p>
          </div>
        </div>

        <dl className="mt-8 space-y-5 text-sm">
          <div>
            <dt className="font-semibold text-[#3b312b]">Bio</dt>
            <dd className="mt-1 leading-6 text-[#67564c]">
              {profile.bio || <EmptyValue>Share a short introduction when you are ready.</EmptyValue>}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#3b312b]">Favorite verse</dt>
            <dd className="mt-1 leading-6 text-[#67564c]">
              {profile.favorite_verse || <EmptyValue>Add a verse that anchors your season.</EmptyValue>}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#3b312b]">Faith community</dt>
            <dd className="mt-1 leading-6 text-[#67564c]">
              {profile.church_name || <EmptyValue>Add a faith community if you would like.</EmptyValue>}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#3b312b]">Profile photo</dt>
            <dd className="mt-1 break-words leading-6 text-[#67564c]">
              {profile.avatar_url ? "Uploaded" : <EmptyValue>No profile photo added yet.</EmptyValue>}
            </dd>
          </div>
        </dl>
        </DetailHero>
      </aside>

      <FormShell className="max-w-none" title="Edit profile" description="Keep your community presence simple and personal.">
        {message ? <FormNotice className="mb-6">{message}</FormNotice> : null}

        <form action={uploadCurrentUserAvatar} className="rounded-xl border border-[#ead6c5] bg-[#fffaf4] p-4 sm:p-5">
          <FormField>
            <FormLabel htmlFor="profile-avatar">Profile photo</FormLabel>
            <input
              id="profile-avatar"
              name="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={`${formControlClassName} file:mr-4 file:rounded-full file:border-0 file:bg-[#a94720] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white`}
            />
            <FormHint>JPG, PNG, or WebP. Maximum 5MB.</FormHint>
          </FormField>
          <SubmitButton variant="secondary" pendingLabel="Uploading…" className="mt-4">Upload photo</SubmitButton>
        </form>

        <form action={updateCurrentUserProfile} className="mt-8">
          <FormSection title="Public information">
          <FormField>
            <FormLabel htmlFor="profile-display-name" required>Display name</FormLabel>
            <input
              id="profile-display-name"
              required
              name="display_name"
              type="text"
              defaultValue={profile.display_name}
              className={formControlClassName}
            />
          </FormField>
          <FormField>
            <FormLabel htmlFor="profile-username">Username</FormLabel>
            <input
              id="profile-username"
              name="username"
              type="text"
              defaultValue={profile.username || ""}
              className={formControlClassName}
            />
            <FormHint>Shown with an @ prefix when present.</FormHint>
          </FormField>
          <FormField>
            <FormLabel htmlFor="profile-bio">Bio</FormLabel>
            <textarea
              id="profile-bio"
              name="bio"
              rows={4}
              defaultValue={profile.bio || ""}
              className={formControlClassName}
            />
          </FormField>
          <FormField>
            <FormLabel htmlFor="profile-favorite-verse">Favorite verse</FormLabel>
            <input
              id="profile-favorite-verse"
              name="favorite_verse"
              type="text"
              defaultValue={profile.favorite_verse || ""}
              className={formControlClassName}
            />
          </FormField>
          <FormField>
            <FormLabel htmlFor="profile-faith-community">Faith community</FormLabel>
            <input
              id="profile-faith-community"
              name="church_name"
              type="text"
              defaultValue={profile.church_name || ""}
              className={formControlClassName}
            />
            <FormHint>Optional. This remains a personal profile detail and does not affect platform access.</FormHint>
          </FormField>
          </FormSection>
          <input type="hidden" name="avatar_url" value={profile.avatar_url || ""} />

          <FormActions className="mt-7">
            <SubmitButton pendingLabel="Saving profile…">Save profile</SubmitButton>
          </FormActions>
        </form>
      </FormShell>
    </div>
  );
}
