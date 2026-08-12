import { NextResponse } from "next/server";
import { getErrorMetadata, logEvent } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next") || "/community";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/community";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logEvent("warn", "auth.callback.exchange_failed", {
        requestId: request.headers.get("x-selah-request-id"),
        provider: "supabase",
        ...getErrorMetadata(error),
      });
      return NextResponse.redirect(new URL("/signin?message=We could not confirm that sign-in link. Please request a new one.", requestUrl.origin));
    }
  } else {
    logEvent("warn", "auth.callback.code_missing", {
      requestId: request.headers.get("x-selah-request-id"),
      provider: "supabase",
      reason: "missing_code",
    });
    return NextResponse.redirect(new URL("/signin?message=Confirmation link is missing required information.", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
