import Link from "next/link";
import { PageState } from "@/components/ui/page-state";

export default function NotFound() {
  return (
    <PageState
      eyebrow="Page not found"
      title="This fellowship path is quiet"
      action={
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-[#a94720] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b94f22]"
        >
          Return home
        </Link>
      }
    >
      <p>The page may have moved, or the link may no longer be available.</p>
    </PageState>
  );
}
