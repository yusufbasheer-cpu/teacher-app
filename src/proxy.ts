import { createMiddlewareSupabaseClient } from "@/lib/supabase-ssr";
import { NextResponse, type NextRequest } from "next/server";
import { USER_EMAIL_HEADER, USER_ID_HEADER } from "@/lib/auth-header-names";
import type { User } from "@supabase/supabase-js";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_ORIGINS = new Set([
  "https://layah.in",
  "https://www.layah.in",
  "http://localhost:3000",
  "http://localhost:3001",
  ...(process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : []),
]);

/**
 * Rebuilds `response` so the given user identity is visible to downstream
 * Server Components via request headers (read back in src/lib/auth-headers.ts)
 * — this is what lets pages skip a second supabase.auth.getUser() network
 * round-trip. Carries over any Set-Cookie headers Supabase's session refresh
 * already added onto `response` (getUser() can rotate the session token),
 * since building the header-carrying response requires a new object.
 */
function withUserHeaders(
  request: NextRequest,
  response: NextResponse,
  user: User | null,
): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(USER_ID_HEADER, user?.id ?? "");
  requestHeaders.set(USER_EMAIL_HEADER, user?.email ?? "");

  const next = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
  return next;
}

/**
 * True when the request's Origin is the deployment's own host.
 *
 * This is the actual CSRF invariant — a cross-site request cannot forge an
 * Origin matching the host it is being sent to — and it is what the static
 * allowlist above was approximating. Checking it directly is both stricter
 * (no origin is trusted on a host it does not belong to) and correct on hosts
 * that cannot be known ahead of time.
 *
 * That last part is the bug this fixes: every Vercel preview deployment gets a
 * generated hostname, so no preview URL was ever in the allowlist and every
 * mutating `/api/*` call from one — sign-in, generation, save, delete — came
 * back 403. The branch preview looked fine until you tried to do anything.
 *
 * `x-forwarded-host` is what the platform sets when proxying; fall back to the
 * Host header for local development.
 */
function isSameOrigin(request: NextRequest, origin: string): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function csrfGuard(request: NextRequest): NextResponse | null {
  if (!MUTATION_METHODS.has(request.method)) return null;
  if (!request.nextUrl.pathname.startsWith("/api/")) return null;

  const origin = request.headers.get("origin");
  if (!origin) return null; // no origin = same-origin server request

  if (ALLOWED_ORIGINS.has(origin)) return null;
  if (isSameOrigin(request, origin)) return null;

  console.warn("[csrf] Blocked mutation from origin:", origin, request.nextUrl.pathname);
  return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Refresh auth session (cookies) and forward OAuth ?code= to /auth/callback.
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function proxy(request: NextRequest) {
  const csrfBlock = csrfGuard(request);
  if (csrfBlock) return csrfBlock;

  const code = request.nextUrl.searchParams.get("code");
  const pathname = request.nextUrl.pathname;

  // Server pages — session refresh only, no route interception.
  if (pathname === "/school-admin" || pathname === "/super-admin") {
    const response = NextResponse.next({ request });
    const supabase = createMiddlewareSupabaseClient(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return withUserHeaders(request, response, user);
  }

  // /school-register with ?code= should exchange via /auth/callback then return to the register page.
  if (code && pathname === "/school-register") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/callback";
    redirectUrl.searchParams.set("redirect_to", "/school-register?step=2");
    const redirectResponse = NextResponse.redirect(redirectUrl);
    request.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    console.log("[proxy] OAuth code on /school-register → /auth/callback → /school-register?step=2");
    return redirectResponse;
  }

  if (code && pathname !== "/auth/callback") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/callback";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    request.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    console.log("[proxy] OAuth code on", pathname, "→ /auth/callback");
    return redirectResponse;
  }

  const response = NextResponse.next({ request });

  const supabase = createMiddlewareSupabaseClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    (pathname.startsWith("/auth") && pathname !== "/auth/callback") ||
    pathname === "/login" ||
    pathname === "/signup";

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    const redirectResponse = NextResponse.redirect(url);
    const redirectSupabase = createMiddlewareSupabaseClient(request, redirectResponse);
    await redirectSupabase.auth.getUser();
    return redirectResponse;
  }

  return withUserHeaders(request, response, user);
}

export const config = {
  matcher: [
    // "ingest" is the PostHog reverse proxy (rewrites in next.config.ts) — a
    // passthrough, not an app route, so it must not pay for session refresh.
    "/((?!_next/static|_next/image|favicon.ico|ingest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
