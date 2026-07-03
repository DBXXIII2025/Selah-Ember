import Link from "next/link";

type CommunityFormProps = {
  message?: string;
  draftMode?: boolean;
};

export function CommunityForm({ message, draftMode = false }: CommunityFormProps) {
  void draftMode;

  return (
    <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-6 shadow-sm">
      <h2 className="text-2xl font-semibold">Open community</h2>
      <p className="mt-3 leading-7 text-[#67564c]">
        Selah Ember now uses one open community feed. Create a Bible study group when you need a focused space.
      </p>

      {message ? (
        <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
          {message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/community" className="inline-flex justify-center rounded-full bg-[#a94720] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#a94720]/20 transition hover:bg-[#b94f22]">
          Open community
        </Link>
        <Link href="/groups/new" className="inline-flex justify-center rounded-full border border-[#2f2722]/20 px-5 py-3 text-sm font-semibold text-[#2f2722] transition hover:bg-[#fff4e8]">
          Create group
        </Link>
      </div>
    </section>
  );
}
