import { NextResponse } from "next/server";
import {
  applySchoolPlanForEmail,
  findSchoolByEmailDomain,
  upsertSchoolUserUsage,
} from "@/lib/auth-callback-school";
import { buildSchoolWelcomeMessage } from "@/lib/school-accounts";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const runtime = "nodejs";

/**
 * Google OAuth callback — exchange PKCE code, assign school plan, redirect to dashboard.
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

  const supabase = await createServerSupabaseClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession failed:", exchangeError.message);
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email;
  const userId = user?.id;

  console.log("[auth/callback] User after exchange:", { email, userId });

  const redirectUrl = new URL("/dashboard", origin);
  redirectUrl.searchParams.set("school_check", "1");

  let schoolMatched = "0";

  if (email && userId) {
    const admin = getSupabaseServiceRole();
    const school = admin ? await findSchoolByEmailDomain(admin, email) : null;

    if (school && user) {
      const applied = await upsertSchoolUserUsage(supabase, user.id, school);

      if (applied) {
        schoolMatched = "1";
        redirectUrl.searchParams.set(
          "school_welcome",
          encodeURIComponent(buildSchoolWelcomeMessage(school.school_name)),
        );

        if (admin) {
          await admin.from("school_teachers").upsert(
            {
              school_account_id: school.id,
              user_id: userId,
              email: email.trim().toLowerCase(),
            },
            { onConflict: "user_id" },
          );

          await admin.auth.admin.updateUserById(userId, {
            user_metadata: {
              school_id: school.id,
              school_name: school.school_name,
            },
          });
        }
      } else if (admin) {
        const result = await applySchoolPlanForEmail(userId, email, supabase);
        schoolMatched = result.matched ? "1" : "0";
        if (result.welcomeMessage) {
          redirectUrl.searchParams.set("school_welcome", encodeURIComponent(result.welcomeMessage));
        }
      }
    } else {
      const result = await applySchoolPlanForEmail(userId, email, supabase);
      schoolMatched = result.matched ? "1" : "0";
      if (result.welcomeMessage) {
        redirectUrl.searchParams.set("school_welcome", encodeURIComponent(result.welcomeMessage));
      }
    }
  }

  redirectUrl.searchParams.set("school_matched", schoolMatched);

  console.log("[auth/callback] school_matched:", schoolMatched);
  console.log("[auth/callback] Redirecting to /dashboard");

  return NextResponse.redirect(redirectUrl.toString());
}
