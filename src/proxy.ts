import { createMiddlewareSupabaseClient } from "@/lib/supabase-ssr";
import { NextResponse, type NextRequest } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_ORIGINS = new Set([
  "https://layah.in",
  "https://www.layah.in",
  "http://localhost:3000",
  "http://localhost:3001",
  ...(process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : []),
]);

function csrfGuard(request: NextRequest): NextResponse | null {
  if (!MUTATION_METHODS.has(request.method)) return null;
  if (!request.nextUrl.pathname.startsWith("/api/")) return null;

  const origin = request.headers.get("origin");
  if (!origin) return null; // no origin = same-origin server request

  if (ALLOWED_ORIGINS.has(origin)) return null;

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
    await supabase.auth.getUser();
    return response;
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

  let response = NextResponse.next({ request });

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
    response = NextResponse.redirect(url);
    const redirectSupabase = createMiddlewareSupabaseClient(request, response);
    await redirectSupabase.auth.getUser();
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
