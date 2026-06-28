import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Search, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const actionStyles = {
  primary:
    "bg-[#cf5f2b] text-white shadow-lg shadow-[#cf5f2b]/20 hover:bg-[#b94f22] focus-visible:ring-[#cf5f2b]/30",
  secondary:
    "border border-[#2f2722]/20 bg-white/70 text-[#2f2722] hover:bg-white focus-visible:ring-[#2f2722]/15",
  quiet:
    "text-[#8a3f1e] hover:bg-[#fff4e8] hover:text-[#b94f22] focus-visible:ring-[#cf5f2b]/20",
  danger:
    "border border-[#b42318]/30 bg-white text-[#b42318] hover:bg-[#fff1f0] focus-visible:ring-[#b42318]/20",
};

export const formControlClassName =
  "mt-2 w-full rounded-xl border border-[#d9c1ad] bg-white px-4 py-3 text-[#211814] outline-none transition placeholder:text-[#9a8172] focus-visible:border-[#cf5f2b] focus-visible:ring-4 focus-visible:ring-[#cf5f2b]/10 disabled:cursor-not-allowed disabled:bg-[#f3ece4] disabled:text-[#8a7467]";

type ActionButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: keyof typeof actionStyles;
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  name?: string;
  value?: string;
};

export function ActionButton({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  disabled,
  name,
  value,
}: ActionButtonProps) {
  const classes = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "px-4 py-2 text-sm" : "px-5 py-3 text-sm",
    actionStyles[variant],
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} name={name} value={value} className={classes}>
      {children}
    </button>
  );
}

export function PageContainer({
  children,
  size = "wide",
  className,
}: Readonly<{
  children: ReactNode;
  size?: "medium" | "wide";
  className?: string;
}>) {
  return (
    <section className={cn("px-5 py-10 sm:px-8 sm:py-12 lg:px-16", className)}>
      <div className={cn("mx-auto", size === "medium" ? "max-w-4xl" : "max-w-7xl")}>{children}</div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  bordered = false,
  className,
}: Readonly<{
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  bordered?: boolean;
  className?: string;
}>) {
  return (
    <header
      className={cn(
        "flex flex-col justify-between gap-5 sm:flex-row sm:items-end",
        bordered && "border-b border-[#d9b99d] pb-8",
        className,
      )}
    >
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b94f22] sm:text-sm">
            {eyebrow}
          </p>
        ) : null}
        <h1 className={cn("text-3xl font-semibold tracking-[-0.02em] sm:text-4xl", eyebrow && "mt-3")}>{title}</h1>
        {description ? <div className="mt-4 max-w-2xl leading-7 text-[#67564c]">{description}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: Readonly<{
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-[#67564c]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function ContentCard({
  children,
  className,
  as: Tag = "article",
}: Readonly<{
  children: ReactNode;
  className?: string;
  as?: "article" | "section" | "div";
}>) {
  return (
    <Tag className={cn("rounded-2xl border border-[#ead6c5] bg-white/75 p-5 shadow-sm sm:p-6", className)}>
      {children}
    </Tag>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: Readonly<{
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn("rounded-2xl border border-dashed border-[#d79568] bg-white/65 px-5 py-10 text-center sm:p-10", className)}>
      {Icon ? (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
      ) : null}
      <h2 className={cn("text-xl font-semibold sm:text-2xl", Icon && "mt-5")}>{title}</h2>
      <div className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">{description}</div>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "ember",
  className,
}: Readonly<{
  children: ReactNode;
  tone?: "ember" | "success" | "neutral" | "solid";
  className?: string;
}>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        tone === "ember" && "bg-[#fff4e8] text-[#8a3f1e]",
        tone === "success" && "bg-[#eef7ee] text-[#386641]",
        tone === "neutral" && "bg-[#f3ece4] text-[#67564c]",
        tone === "solid" && "bg-[#cf5f2b] text-white",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  icon: Icon,
  title,
  value,
  description,
  action,
  className,
}: Readonly<{
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  title: ReactNode;
  value?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <ContentCard className={className}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {value ? <p className="mt-2 text-3xl font-semibold text-[#8a3f1e]">{value}</p> : null}
        </div>
        {Icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </div>
        ) : null}
      </div>
      {description ? <div className="mt-4 leading-7 text-[#67564c]">{description}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </ContentCard>
  );
}

export function SearchInput({
  name = "search",
  defaultValue,
  placeholder = "Search",
  label = "Search",
  className,
}: Readonly<{
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  className?: string;
}>) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a7467]" />
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-full border border-[#d9b99d] bg-white/80 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#8a7467] focus-visible:border-[#cf5f2b] focus-visible:ring-4 focus-visible:ring-[#cf5f2b]/10"
      />
    </label>
  );
}

export function LoadingState({ rows = 3, className }: Readonly<{ rows?: number; className?: string }>) {
  return (
    <div className={cn("space-y-4", className)} role="status" aria-live="polite" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} aria-hidden="true" className="animate-pulse rounded-2xl border border-[#ead6c5] bg-white/60 p-6">
          <div className="h-5 w-2/5 rounded-full bg-[#ead6c5]" />
          <div className="mt-4 h-3 w-full rounded-full bg-[#f0dfcf]" />
          <div className="mt-2 h-3 w-4/5 rounded-full bg-[#f0dfcf]" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function FormShell({
  title,
  description,
  children,
  className,
}: Readonly<{
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <ContentCard as="section" className={cn("mx-auto w-full max-w-3xl p-5 sm:p-8", className)}>
      <h2 className="text-xl font-semibold tracking-[-0.01em] sm:text-2xl">{title}</h2>
      {description ? <div className="mt-3 max-w-2xl leading-7 text-[#67564c]">{description}</div> : null}
      <div className="mt-7">{children}</div>
    </ContentCard>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: Readonly<{
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <fieldset className={cn("space-y-5", className)}>
      {title ? <legend className="text-lg font-semibold text-[#2f2722]">{title}</legend> : null}
      {description ? <p className="-mt-3 text-sm leading-6 text-[#67564c]">{description}</p> : null}
      {children}
    </fieldset>
  );
}

export function FormField({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return <div className={cn("block", className)}>{children}</div>;
}

export function FormLabel({
  children,
  htmlFor,
  required = false,
  className,
}: Readonly<{
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}>) {
  return (
    <label htmlFor={htmlFor} className={cn("text-sm font-semibold text-[#3b312b]", className)}>
      {children}
      {required ? <span className="ml-1 text-[#b94f22]" aria-hidden="true">*</span> : null}
      {required ? <span className="sr-only"> (required)</span> : null}
    </label>
  );
}

export function FormHint({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return <p className={cn("mt-2 text-sm leading-6 text-[#67564c]", className)}>{children}</p>;
}

export function FormError({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div
      role="alert"
      className={cn("flex items-start gap-3 rounded-xl border border-[#dc8d78] bg-[#fff1ed] px-4 py-3 text-sm leading-6 text-[#8f2f20]", className)}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function FormNotice({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div
      role="status"
      className={cn("rounded-xl border border-[#e5b08c] bg-[#fff4e8] px-4 py-3 text-sm leading-6 text-[#8a3f1e]", className)}
    >
      {children}
    </div>
  );
}

export function FormActions({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return <div className={cn("flex flex-col-reverse gap-3 border-t border-[#ead6c5] pt-6 [&>*]:w-full sm:flex-row sm:items-center sm:justify-end sm:[&>*]:w-auto", className)}>{children}</div>;
}

export function DetailHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: Readonly<{
  backHref: string;
  backLabel: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}>) {
  return (
    <div className={className}>
      <ActionButton href={backHref} variant="quiet" size="sm" className="-ml-4">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {backLabel}
      </ActionButton>
      <PageHeader eyebrow={eyebrow} title={title} description={description} action={action} className="mt-6" />
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}

export function DetailHero({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <ContentCard as="article" className={cn("p-5 sm:p-8", className)}>
      {children}
    </ContentCard>
  );
}

export function DestructiveActionPanel({
  title,
  description,
  children,
  className,
}: Readonly<{
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={cn("rounded-2xl border border-[#e5b2a7] bg-[#fff8f6] p-5", className)}>
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#b42318]" />
        <div>
          <h2 className="font-semibold text-[#7a271a]">{title}</h2>
          <div className="mt-1 text-sm leading-6 text-[#67564c]">{description}</div>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function ConfirmActionPanel({
  action,
  hiddenFields,
  title,
  description,
  actionLabel,
  confirmationName = "confirmation",
  confirmationValue = "DELETE",
  confirmationId,
  className,
}: Readonly<{
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string>;
  title: ReactNode;
  description: ReactNode;
  actionLabel: string;
  confirmationName?: string;
  confirmationValue?: string;
  confirmationId?: string;
  className?: string;
}>) {
  const inputId = confirmationId || `${confirmationName}-confirm`;

  return (
    <DestructiveActionPanel title={title} description={description} className={className}>
      <form action={action} aria-label={`${actionLabel} confirmation`} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {Object.entries(hiddenFields || {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <FormField className="flex-1">
          <FormLabel htmlFor={inputId}>Type {confirmationValue} to confirm</FormLabel>
          <input
            id={inputId}
            name={confirmationName}
            type="text"
            placeholder={confirmationValue}
            autoComplete="off"
            className={formControlClassName}
          />
        </FormField>
        <ActionButton type="submit" variant="danger" className="sm:mb-0.5">
          {actionLabel}
        </ActionButton>
      </form>
    </DestructiveActionPanel>
  );
}
