import Link from "next/link";
import { cn } from "@/lib/utils/cn";

const tabs = [
  { href: "/community", label: "Home" },
  { href: "/community/topics", label: "Topics" },
  { href: "/community/testimonies", label: "Testimonies" },
] as const;

export function CommunityTabs({ active }: Readonly<{ active: "home" | "topics" | "testimonies" }>) {
  return (
    <nav aria-label="Community views" className="mt-6 overflow-x-auto">
      <div className="inline-flex min-w-full rounded-full border border-[#d9b99d] bg-white/70 p-1 sm:min-w-0">
        {tabs.map((tab) => {
          const selected =
            (active === "home" && tab.label === "Home")
            || (active === "topics" && tab.label === "Topics")
            || (active === "testimonies" && tab.label === "Testimonies");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition sm:flex-none",
                selected ? "bg-[#a94720] text-white shadow-sm" : "text-[#67564c] hover:bg-[#fff4e8] hover:text-[#8a3f1e]",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
