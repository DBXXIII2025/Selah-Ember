import Link from "next/link";
import { isSafeHttpUrl } from "@/lib/media/validation";

type SafeLinkProps = {
  href: string | null | undefined;
  children: React.ReactNode;
  className?: string;
};

export function SafeLink({ href, children, className }: SafeLinkProps) {
  if (!href || !isSafeHttpUrl(href)) {
    return <span className={className}>{children}</span>;
  }

  const isExternal = href.startsWith("http://") || href.startsWith("https://");

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
