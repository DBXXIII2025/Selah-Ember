import type { ReactNode } from "react";
import { BrandMark } from "@/components/ui/brand-mark";

type PageStateProps = {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

export function PageState({ eyebrow, title, children, action }: PageStateProps) {
  return (
    <section className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(217,120,52,0.18),transparent_34%),linear-gradient(135deg,#151210,#2a211d)] px-6 py-16 text-[#fff4df] sm:px-10">
      <div className="w-full max-w-2xl rounded-2xl border border-[#c8874d]/35 bg-[#211814]/82 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur sm:p-10">
        <div className="flex justify-center">
          <BrandMark variant="light" />
        </div>
        {eyebrow ? (
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[#d8965c]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">{title}</h1>
        <div className="mx-auto mt-4 max-w-xl leading-7 text-[#e8ccb0]">{children}</div>
        {action ? <div className="mt-7">{action}</div> : null}
      </div>
    </section>
  );
}
