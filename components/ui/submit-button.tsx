"use client";

import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { ActionButton } from "@/components/ui/app-ui";

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  className,
}: Readonly<{
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}>) {
  const { pending } = useFormStatus();

  return (
    <ActionButton type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
      {pending ? pendingLabel : children}
    </ActionButton>
  );
}
