"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useDismissibleLayer } from "@/components/ui/use-dismissible-layer";

export type NavigationItem = {
  href: string;
  label: string;
  count?: number;
};

export const PUBLIC_NAVIGATION_ITEMS: NavigationItem[] = [
  { href: "/discover", label: "Discover" },
  { href: "/discover/groups", label: "Groups" },
  { href: "/community", label: "Community" },
  { href: "/signin", label: "Sign in" },
];

function isCurrentPath(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/discover") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({ item, pathname, onNavigate }: Readonly<{
  item: NavigationItem;
  pathname: string;
  onNavigate?: () => void;
}>) {
  const current = isCurrentPath(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0a35c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151210] xl:min-h-0 xl:rounded-lg xl:px-2 xl:py-2",
        current ? "bg-[#fff4df]/10 text-[#f0a35c]" : "text-[#d8bea3] hover:bg-[#fff4df]/5 hover:text-[#fff4df]",
      )}
    >
      <span>{item.label}</span>
      {item.count && item.count > 0 ? (
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#cf5f2b] px-2 py-0.5 text-xs text-white" aria-label={`${item.count} unread`}>
          {item.count}
        </span>
      ) : null}
    </Link>
  );
}

export function ResponsiveNavigation({
  items,
  signOutAction,
}: Readonly<{
  items: NavigationItem[];
  signOutAction?: () => Promise<void>;
}>) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  useDismissibleLayer({ open, setOpen, triggerRef: buttonRef, layerRef: menuRef });

  return (
    <div className="relative ml-auto flex items-center">
      <div className="hidden items-center gap-2 xl:flex">
        <nav aria-label="Primary navigation" className="flex items-center gap-1">
          {items.map((item) => <NavigationLink key={item.href} item={item} pathname={pathname} />)}
        </nav>
        {signOutAction ? (
          <form action={signOutAction} className="ml-2 border-l border-[#c8874d]/30 pl-4">
            <button type="submit" className="min-h-11 rounded-full border border-[#c8874d]/45 px-4 py-2 text-sm font-semibold text-[#fff4df] transition hover:bg-[#fff4df]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0a35c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151210]">
              Sign out
            </button>
          </form>
        ) : null}
      </div>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-primary-navigation"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-haspopup="true"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#c8874d]/45 text-[#fff4df] transition hover:bg-[#fff4df]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0a35c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151210] xl:hidden"
      >
        {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
      </button>

      {open ? (
        <nav
          ref={menuRef}
          id="mobile-primary-navigation"
          aria-label="Mobile primary navigation"
          className="absolute right-0 top-14 z-50 max-h-[calc(100dvh-6rem)] w-[min(20rem,calc(100vw-2.5rem))] overflow-y-auto rounded-2xl border border-[#c8874d]/40 bg-[#1c1714] p-3 shadow-2xl shadow-black/30 xl:hidden"
        >
          <div className="grid gap-1">
            {items.map((item) => <NavigationLink key={item.href} item={item} pathname={pathname} onNavigate={() => setOpen(false)} />)}
          </div>
          {signOutAction ? (
            <form action={signOutAction} className="mt-3 border-t border-[#c8874d]/30 pt-3">
              <button type="submit" className="flex min-h-11 w-full items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#fff4df] transition hover:bg-[#fff4df]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0a35c]">
                Sign out
              </button>
            </form>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
