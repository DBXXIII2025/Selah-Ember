import type { ReactNode } from "react";

type PageStateProps = {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

export function PageState({ eyebrow, title, children, action }: PageStateProps) {
  return (
    <section className="flex min-h-screen items-center justify-center bg-[#fff8ed] px-6 py-16 text-[#211b17] sm:px-10">
      <div className="w-full max-w-2xl rounded-2xl border border-[#ead6c5] bg-white/75 p-8 text-center shadow-sm sm:p-10">
        {eyebrow ? (
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{title}</h1>
        <div className="mx-auto mt-4 max-w-xl leading-7 text-[#67564c]">{children}</div>
        {action ? <div className="mt-7">{action}</div> : null}
      </div>
    </section>
  );
}
