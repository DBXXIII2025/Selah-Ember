import { getActiveBanForUser } from "@/lib/moderation/bans";
import { createClient } from "@/lib/supabase/server";

export default async function AccountRestrictedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ban = user ? await getActiveBanForUser(user.id) : null;

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#ead6c5] bg-white/75 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
          Account restriction
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Some actions are temporarily unavailable</h1>
        <p className="mt-4 leading-7 text-[#67564c]">
          You can still sign in and read available areas, but creating or joining communities,
          groups, prayer requests, events, RSVPs, memberships, and future messages/posts is blocked
          while this restriction is active.
        </p>
        {ban ? (
          <div className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
            <p className="font-semibold">Reason: {ban.reason}</p>
            <p className="mt-1">Expires: {new Date(ban.expires_at).toLocaleString()}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
