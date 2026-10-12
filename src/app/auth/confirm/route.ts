import { NextResponse } from "next/server";
import { applySchoolPlanForEmail } from "@/lib/auth-callback-school";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { sendWelcomeEmailIfNew } from "@/lib/welcome-email";
import { hasCompletedTeacherProfile } from "@/lib/user-profile";

export const runtime = "nodejs";

function loginWithError(origin: string, message: string) {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", message);
  return NextResponse.redirect(loginUrl);
}

/**
 * Supabase's confirmation template links here with a token hash. Verifying it
 * server-side sets the auth cookies without relying on the PKCE cookie from the
 * browser where signup started (the email may be opened on another device).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const tokenHash = url.searchParams.get("token_hash");

  if (!tokenHash || url.searchParams.get("type") !== "email") {
    return loginWithError(origin, "This confirmation link is invalid. Please request a new one.");
  }

  const supabase = await createServerSupabaseClient();
  let user;
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    if (error) {
      console.error("[auth/confirm] Email verification failed:", error.message);
      return loginWithError(
        origin,
        "This confirmation link has expired or was already used. Try logging in or request a new link.",
      );
    }
    user = data.user;
  } catch (error) {
    console.error("[auth/confirm] Email verification request failed:", error);
    return loginWithError(origin, "We couldn't verify your email right now. Please try the link again.");
  }

  if (!user?.email) {
    console.error("[auth/confirm] Email verification returned no user");
    return loginWithError(
      origin,
      "This confirmation link has expired or was already used. Try logging in or request a new link.",
    );
  }

  try {
    await applySchoolPlanForEmail(user.id, user.email, supabase);
  } catch (error) {
    console.error("[auth/confirm] Could not apply school plan:", error);
  }
  await sendWelcomeEmailIfNew(user.id, user.email, user.user_metadata?.full_name);

  const destination = hasCompletedTeacherProfile(user) ? "/dashboard" : "/onboarding";
  return NextResponse.redirect(new URL(destination, origin));
}
