"use client";

import { useEffect } from "react";
import { logClientError } from "@/lib/observability/client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError("ui.global.error", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[#f7f1e8] px-6 text-[#34251d]">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#a94720]">Something went wrong</p>
            <h1 className="mt-3 text-3xl font-semibold">Selah Ember could not load</h1>
            <p className="mt-4 text-sm text-[#6c584c]">Retry the page. If the problem continues, record the time for support.</p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 rounded-full bg-[#a94720] px-5 py-3 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
