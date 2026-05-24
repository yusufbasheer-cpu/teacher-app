import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { buildSchoolWelcomeMessage, normalizeEmailDomain } from "@/lib/school-accounts";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { firstDayOfNextMonthUtc } from "@/lib/user-usage";

export const runtime = "nodejs";

/**
 * Google OAuth callback — exchange code, then match school email domain and assign plan.
 * Logs appear in the server terminal (Vercel/local `npm run dev` output).
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const next = requestUrl.searchParams.get("next") ?? "/lesson-plan";

  if (!code) {
    console.log("[auth/callback] No code in URL — redirecting to login");
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
  const domain = email?.split("@")[1]?.trim().toLowerCase();

  console.log("Checking school domain for:", domain);

  const admin = getSupabaseServiceRole();
  let school: Record<string, unknown> | null = null;

  if (domain && admin) {
    const normalizedDomain = normalizeEmailDomain(domain);
    const { data, error: schoolError } = await admin
      .from("school_accounts")
      .select("*")
      .eq("email_domain", normalizedDomain)
      .maybeSingle();

    if (schoolError) {
      console.log("School query error:", schoolError.message);
    }

    school = data;
  } else if (!admin) {
    console.warn("[auth/callback] SUPABASE_SERVICE_ROLE_KEY missing — cannot query school_accounts");
  }

  console.log("School found:", school);

  const userId = user.data.user?.id;
  if (school && userId && admin) {
    const planType = String(school.plan_type);
    const resetDate = firstDayOfNextMonthUtc();

    const { error: usageError } = await admin.from("user_usage").upsert(
      {
        user_id: userId,
        plan_type: planType,
        generations_limit: -1,
        generations_used: 0,
        reset_date: resetDate,
      },
      { onConflict: "user_id" },
    );

    if (usageError) {
      console.error("[auth/callback] user_usage upsert error:", usageError.message);
    } else {
      console.log("User assigned to school plan");
    }

    const schoolId = String(school.id);
    const schoolName = String(school.school_name);

    await admin.from("school_teachers").upsert(
      {
        school_account_id: schoolId,
        user_id: userId,
        email: email!.trim().toLowerCase(),
      },
      { onConflict: "user_id" },
    );

    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        school_id: schoolId,
        school_name: schoolName,
      },
    });

    const welcomeMessage = buildSchoolWelcomeMessage(schoolName);
    const completeUrl = new URL("/auth/callback/complete", origin);
    completeUrl.searchParams.set("school_welcome", encodeURIComponent(welcomeMessage));
    return NextResponse.redirect(completeUrl.toString());
  }

  return NextResponse.redirect(`${origin}/auth/callback/complete`);
}
