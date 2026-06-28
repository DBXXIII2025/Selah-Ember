import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(217,120,52,0.18),transparent_32%),linear-gradient(135deg,#f7ead7,#fff8ed)] text-[#211814]">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="px-5 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <BrandMark />
          <nav aria-label="Authentication navigation">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-[#8a3f1e] transition hover:text-[#b94f22] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d87836]/20">
              Back home
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="px-5 pb-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
