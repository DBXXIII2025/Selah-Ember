import Image from "next/image";
import Link from "next/link";

type BrandMarkProps = {
  href?: string;
  variant?: "light" | "dark";
  compact?: boolean;
};

export function BrandMark({ href = "/", variant = "dark", compact = false }: BrandMarkProps) {
  const content = (
    <span className="inline-flex items-center gap-3">
      <span className="relative flex h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#c8874d]/50 bg-[#11100e] shadow-[0_0_28px_rgba(229,111,44,0.22)]">
        <Image
          src="/images/selah-ember-logo.png"
          alt=""
          fill
          sizes="44px"
          className="object-cover object-[50%_31%] scale-[2.9]"
          priority={compact}
        />
      </span>
      {!compact ? (
        <span className="leading-none max-[360px]:hidden">
          <span
            className={`block font-serif text-xl font-semibold ${
              variant === "light" ? "text-[#fff4df]" : "text-[#231915]"
            }`}
          >
            Selah Ember
          </span>
          <span
            className={`mt-1 block text-[0.62rem] font-semibold uppercase tracking-[0.22em] ${
              variant === "light" ? "text-[#d8965c]" : "text-[#9b572f]"
            }`}
          >
            Faith · Reflection · Community
          </span>
        </span>
      ) : null}
    </span>
  );

  return (
    <Link href={href} aria-label="Selah Ember" className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d87836]/25">
      {content}
    </Link>
  );
}
