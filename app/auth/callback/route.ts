import { NextResponse } from "next/server";
import { getErrorMetadata, logEvent } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/community";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logEvent("warn", "auth.callback.exchange_failed", {
        requestId: request.headers.get("x-selah-request-id"),
        provider: "supabase",
        ...getErrorMetadata(error),
      });
    }
  } else {
    logEvent("warn", "auth.callback.code_missing", {
      requestId: request.headers.get("x-selah-request-id"),
      provider: "supabase",
      reason: "missing_code",
    });
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
