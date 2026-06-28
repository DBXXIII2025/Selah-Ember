import Link from "next/link";
import type { Metadata } from "next";
import { signUp } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a Selah Ember account and join the open faith community.",
  robots: { index: false, follow: true },
};

type SignUpPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { message } = await searchParams;

  return (
    <section className="rounded-2xl border border-[#ead6c5] bg-white/75 p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
        Begin fellowship
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Create your account</h1>
      <p className="mt-3 leading-7 text-[#67564c]">
        Start with a simple profile for prayer, groups, and community life.
      </p>

      {message ? (
        <p className="mt-6 rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm text-[#8a3f1e]">
          {message}
        </p>
      ) : null}

      <form action={signUp} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-[#3b312b]">Display name</span>
          <input
            required
            name="displayName"
            type="text"
            autoComplete="name"
            className="mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10"
          />
        </label>
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
            minLength={8}
            name="password"
            type="password"
            autoComplete="new-password"
            className="mt-2 w-full rounded-xl border border-[#ead6c5] bg-white px-4 py-3 outline-none transition focus:border-[#cf5f2b] focus:ring-4 focus:ring-[#cf5f2b]/10"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-[#cf5f2b] px-6 py-3 font-semibold text-white shadow-lg shadow-[#cf5f2b]/20 transition hover:bg-[#b94f22]"
        >
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#67564c]">
        Already have an account?{" "}
        <Link href="/signin" className="font-semibold text-[#8a3f1e] hover:text-[#b94f22]">
          Sign in
        </Link>
      </p>
    </section>
  );
}
