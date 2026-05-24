import { NextResponse } from "next/server";
import { applySchoolPlanForEmail } from "@/lib/auth-callback-school";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Google OAuth callback — exchange code, assign school plan, redirect to dashboard.
 * Server logs: terminal / Vercel logs. Browser logs: /dashboard?school_check=1
 */
export async function GET(request: Request) {
  console.log("=== AUTH CALLBACK ROUTE HIT ===");

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  console.log("[auth/callback] URL:", requestUrl.toString());
  console.log("[auth/callback] code present:", Boolean(code));

  if (!code) {
    console.log("[auth/callback] No code — redirecting to login");
    return NextResponse.redirect(`${origin}/auth`);
  }

  const supabase = await createSupabaseRouteClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession failed:", exchangeError.message);
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  const user = await supabase.auth.getUser();
  const email = user.data.user?.email;
  const userId = user.data.user?.id;

  console.log("[auth/callback] User after exchange:", { email, userId });

  let schoolMatched = "0";
  if (email && userId) {
    const result = await applySchoolPlanForEmail(userId, email);
    schoolMatched = result.matched ? "1" : "0";
    if (result.welcomeMessage) {
      const redirectUrl = new URL("/dashboard", origin);
      redirectUrl.searchParams.set("school_check", "1");
      redirectUrl.searchParams.set("school_matched", schoolMatched);
      redirectUrl.searchParams.set(
        "school_welcome",
        encodeURIComponent(result.welcomeMessage),
      );
      console.log("[auth/callback] Redirecting to /dashboard (school matched)");
      return NextResponse.redirect(redirectUrl.toString());
    }
  }

  console.log("[auth/callback] Redirecting to /dashboard");
  const redirectUrl = new URL("/dashboard", origin);
  redirectUrl.searchParams.set("school_check", "1");
  redirectUrl.searchParams.set("school_matched", schoolMatched);
  return NextResponse.redirect(redirectUrl.toString());
}
