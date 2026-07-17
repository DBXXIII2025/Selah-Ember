import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#d9b58d]/45 bg-[#f7ead7] px-5 py-5 text-center text-xs font-medium text-[#67564c] sm:px-8">
      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
        <span>Powered by SeraphCore</span>
        <nav aria-label="Footer navigation" className="flex items-center gap-4">
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
