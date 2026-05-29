import { createCommunity } from "@/app/actions/communities";

type CommunityFormProps = {
  message?: string;
};

const fieldClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

export function CommunityForm({ message }: CommunityFormProps) {
  return (
    <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
      <h2 className="text-2xl font-semibold">Create community</h2>
      <p className="mt-3 leading-7 text-[#67564c]">
        Start with the essentials. Members, groups, and deeper church tools can come later.
      </p>

      {message ? (
        <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
          {message}
        </p>
      ) : null}

      <form action={createCommunity} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Community name</span>
          <input required name="name" type="text" className={fieldClassName} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Description</span>
          <textarea name="description" rows={4} className={fieldClassName} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Location</span>
          <input name="location" type="text" className={fieldClassName} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Banner URL</span>
          <input name="banner_url" type="url" className={fieldClassName} />
        </label>
        <button
          type="submit"
          className="rounded-full bg-[#cf5f2b] px-6 py-3 font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
        >
          Create community
        </button>
      </form>
    </section>
  );
}
