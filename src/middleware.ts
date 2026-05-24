import { createMiddlewareSupabaseClient } from "@/lib/supabase-ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh auth session (cookies) and forward OAuth ?code= to /auth/callback.
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function middleware(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const pathname = request.nextUrl.pathname;

  if (code && pathname !== "/auth/callback") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/callback";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    request.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    console.log("[middleware] OAuth code on", pathname, "→ /auth/callback");
    return redirectResponse;
  }

  let response = NextResponse.next({ request });

  const supabase = createMiddlewareSupabaseClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && pathname.startsWith("/auth") && pathname !== "/auth/callback") {
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
