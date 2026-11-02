import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#d9b58d]/45 bg-[#f7ead7] px-5 py-7 text-center text-xs font-medium text-[#67564c] sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <span>Powered by SeraphCore</span>
        <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-[#8a3f1e]">
            Privacy Policy
          </Link>
          <Link href="/delete-account" className="hover:text-[#8a3f1e]">
            Delete Account
          </Link>
        </nav>
      </div>
    </footer>
  );
}
