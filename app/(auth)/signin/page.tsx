import Link from "next/link";
import { signIn } from "@/app/actions/auth";

type SignInPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { message } = await searchParams;

  return (
    <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
        Welcome back
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Sign in</h1>
      <p className="mt-3 leading-7 text-[#67564c]">
        Return to your Selah Ember fellowship space.
      </p>

      {message ? (
        <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
          {message}
        </p>
      ) : null}

      <form action={signIn} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Email</span>
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Password</span>
          <input
            required
            name="password"
            type="password"
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-[#cf5f2b] px-6 py-3 font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#67564c]">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Create an account
        </Link>
      </p>
    </section>
  );
}
