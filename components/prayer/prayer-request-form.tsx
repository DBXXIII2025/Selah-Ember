import { createPrayerRequest, type PrayerCommunityOption } from "@/app/actions/prayer";

type PrayerRequestFormProps = {
  communities: PrayerCommunityOption[];
  message?: string;
};

const fieldClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

export function PrayerRequestForm({ communities, message }: PrayerRequestFormProps) {
  return (
    <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
      <h2 className="text-2xl font-semibold">Share a prayer request</h2>
      <p className="mt-3 leading-7 text-[#67564c]">
        Keep requests simple for now. Comments, counters, and notifications can come later.
      </p>

      {message ? (
        <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
          {message}
        </p>
      ) : null}

      <form action={createPrayerRequest} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Title</span>
          <input required name="title" type="text" className={fieldClassName} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Content</span>
          <textarea required name="content" rows={5} className={fieldClassName} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Community</span>
          <select name="community_id" className={fieldClassName} defaultValue="">
            <option value="">No community</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-[#ead6c5] bg-white px-4 py-3">
          <input name="is_private" type="checkbox" className="h-4 w-4 accent-[#cf5f2b]" />
          <span>
            <span className="block text-sm font-medium text-[#3b312b]">Private request</span>
            <span className="block text-sm text-[#67564c]">Only you will see this request.</span>
          </span>
        </label>
        <button
          type="submit"
          className="rounded-full bg-[#cf5f2b] px-6 py-3 font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
        >
          Create request
        </button>
      </form>
    </section>
  );
}
