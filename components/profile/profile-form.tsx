import {
  updateCurrentUserProfile,
  uploadCurrentUserAvatar,
  type CurrentUserProfile,
} from "@/app/actions/profile";

type ProfileFormProps = {
  profile: CurrentUserProfile;
  message?: string;
};

const fieldClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

function EmptyValue({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-[#9a8172]">{children}</span>;
}

export function ProfileForm({ profile, message }: ProfileFormProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
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
            <dt className="font-semibold text-[#3b312b]">Church</dt>
            <dd className="mt-1 leading-6 text-[#67564c]">
              {profile.church_name || <EmptyValue>Add your church name.</EmptyValue>}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#3b312b]">Profile photo</dt>
            <dd className="mt-1 break-words leading-6 text-[#67564c]">
              {profile.avatar_url ? "Uploaded" : <EmptyValue>No profile photo added yet.</EmptyValue>}
            </dd>
          </div>
        </dl>
      </aside>

      <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">Edit profile</h2>
        <p className="mt-3 leading-7 text-[#67564c]">
          Keep your fellowship presence simple and personal.
        </p>

        {message ? (
          <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
            {message}
          </p>
        ) : null}

        <form action={uploadCurrentUserAvatar} className="mt-8 rounded-xl border border-[#ead6c5] bg-[#fffaf4] p-4">
          <label className="block">
            <span className="text-sm font-medium text-[#3b312b]">Profile photo</span>
            <input
              name="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={`${fieldClassName} file:mr-4 file:rounded-full file:border-0 file:bg-[#cf5f2b] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white`}
            />
          </label>
          <p className="mt-2 text-sm text-[#67564c]">JPG, PNG, or WebP. Maximum 5MB.</p>
          <button
            type="submit"
            className="mt-4 rounded-full border border-[#2f2722]/20 bg-white px-5 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]"
          >
            Upload photo
          </button>
        </form>

        <form action={updateCurrentUserProfile} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-[#3b312b]">Display name</span>
            <input
              required
              name="display_name"
              type="text"
              defaultValue={profile.display_name}
              className={fieldClassName}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#3b312b]">Username</span>
            <input
              name="username"
              type="text"
              defaultValue={profile.username || ""}
              className={fieldClassName}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#3b312b]">Bio</span>
            <textarea
              name="bio"
              rows={4}
              defaultValue={profile.bio || ""}
              className={fieldClassName}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#3b312b]">Favorite verse</span>
            <input
              name="favorite_verse"
              type="text"
              defaultValue={profile.favorite_verse || ""}
              className={fieldClassName}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#3b312b]">Church name</span>
            <input
              name="church_name"
              type="text"
              defaultValue={profile.church_name || ""}
              className={fieldClassName}
            />
          </label>
          <input type="hidden" name="avatar_url" value={profile.avatar_url || ""} />

          <button
            type="submit"
            className="rounded-full bg-[#cf5f2b] px-6 py-3 font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
          >
            Save profile
          </button>
        </form>
      </section>
    </div>
  );
}
