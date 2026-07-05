"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { PageState } from "@/components/ui/page-state";
import { logClientError } from "@/lib/observability/client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError("ui.route.error", error);
  }, [error]);

  return (
    <PageState
      eyebrow="Something went wrong"
      title="We could not load this space"
      action={
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center rounded-full bg-[#a94720] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b94f22]"
        >
          Try again
        </button>
      }
    >
      <div className="flex flex-col items-center gap-4" role="alert">
        <AlertTriangle aria-hidden="true" className="h-8 w-8 text-[#b94f22]" />
        <p>Please retry the page. If this continues, capture the route and time for launch triage.</p>
      </div>
    </PageState>
  );
}
