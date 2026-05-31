import {
  joinCommunity,
  leaveCommunity,
  type Community,
  type CommunityMembershipStatus,
} from "@/app/actions/communities";
import Link from "next/link";

type CommunityMembershipFormProps = {
  community: Community;
  status: CommunityMembershipStatus;
};

export function CommunityMembershipForm({ community, status }: CommunityMembershipFormProps) {
  if (status.isOwner) {
    return (
      <p className="inline-flex rounded-full bg-[#fff4e8] px-4 py-2 text-sm font-semibold text-[#8a3f1e]">
        You own this community
      </p>
    );
  }

  if (status.isMember) {
    return (
      <form action={leaveCommunity}>
        <input type="hidden" name="community_id" value={community.id} />
        <input type="hidden" name="slug" value={community.slug} />
        <button
          type="submit"
          className="rounded-full border border-[#2f2722]/20 bg-white/70 px-6 py-3 text-sm font-semibold text-[#2f2722] shadow-sm transition hover:bg-white"
        >
          Leave community
        </button>
      </form>
    );
  }

  if (!status.isSignedIn) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/signin"
          className="rounded-full bg-[#cf5f2b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
        >
          Sign in to join
        </Link>
        <p className="text-sm text-[#67564c]">Sign in first, then join this community.</p>
      </div>
    );
  }

  return (
    <form action={joinCommunity}>
      <input type="hidden" name="community_id" value={community.id} />
      <input type="hidden" name="slug" value={community.slug} />
      <button
        type="submit"
        className="rounded-full bg-[#cf5f2b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
      >
        Join community
      </button>
    </form>
  );
}
