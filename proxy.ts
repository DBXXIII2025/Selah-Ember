import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const MIB = 1024 * 1024;
const DEFAULT_SERVER_ACTION_LIMIT = 2 * MIB;
const UPLOAD_ROUTE_LIMITS: Array<{ pattern: RegExp; bytes: number }> = [
  { pattern: /^\/profile\/?$/, bytes: 6 * MIB },
  { pattern: /^\/messages(?:\/|$)/, bytes: 252 * MIB },
  { pattern: /^\/community(?:\/|$)/, bytes: 252 * MIB },
  { pattern: /^\/leader\/communities\/[^/]+\/(?:media|updates)(?:\/|$)/, bytes: 252 * MIB },
];

function getServerActionBodyLimit(pathname: string) {
  return UPLOAD_ROUTE_LIMITS.find(({ pattern }) => pattern.test(pathname))?.bytes || DEFAULT_SERVER_ACTION_LIMIT;
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-selah-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  let authenticatedUserId: string | null = null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticatedUserId = user?.id || null;
  } catch (error) {
    console.warn("[proxy] auth_refresh_unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const isMultipartServerAction =
    request.method === "POST" &&
    request.headers.has("next-action") &&
    request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data");

  if (isMultipartServerAction) {
    const contentLengthValue = request.headers.get("content-length");
    const contentLength = contentLengthValue ? Number(contentLengthValue) : Number.NaN;
    const bodyLimit = getServerActionBodyLimit(request.nextUrl.pathname);

    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      return NextResponse.json({ error: "A valid Content-Length header is required." }, { status: 411 });
    }

    if (contentLength > bodyLimit) {
      return NextResponse.json({ error: "Upload request is too large for this endpoint." }, { status: 413 });
    }

    if (contentLength > DEFAULT_SERVER_ACTION_LIMIT && !authenticatedUserId) {
      return NextResponse.json({ error: "Authentication is required for large uploads." }, { status: 401 });
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
