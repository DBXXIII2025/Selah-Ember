import { updateOwnedCommunity, type LeaderCommunity } from "@/app/actions/leader";

type CommunityEditFormProps = {
  community: LeaderCommunity;
};

const fieldClassName =
  "mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10";

export function CommunityEditForm({ community }: CommunityEditFormProps) {
  return (
    <form action={updateOwnedCommunity} className="space-y-5">
      <input type="hidden" name="community_id" value={community.id} />
      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Community name</span>
        <input required name="name" type="text" defaultValue={community.name} className={fieldClassName} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Description</span>
        <input
          name="description"
          type="text"
          defaultValue={community.description || ""}
          className={fieldClassName}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Location</span>
        <input name="location" type="text" defaultValue={community.location || ""} className={fieldClassName} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-[#3b312b]">Banner URL</span>
        <input
          name="banner_url"
          type="url"
          defaultValue={community.banner_url || ""}
          className={fieldClassName}
        />
      </label>
      <button
        type="submit"
        className="rounded-full bg-[#cf5f2b] px-6 py-3 font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
      >
        Save community
      </button>
    </form>
  );
}
