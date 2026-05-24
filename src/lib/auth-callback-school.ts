import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { buildSchoolWelcomeMessage, normalizeEmailDomain } from "@/lib/school-accounts";
import { schoolPlanResetDate } from "@/lib/school-plan-reset-date";

export type ApplySchoolPlanResult = {
  matched: boolean;
  schoolName?: string;
  welcomeMessage?: string;
};

type SchoolRow = {
  id: string;
  school_name: string;
  plan_type: string;
  email_domain: string;
};

export async function findSchoolByEmailDomain(
  admin: SupabaseClient,
  email: string,
): Promise<SchoolRow | null> {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  console.log("Checking school domain for:", domain);

  if (!domain) {
    console.log("No school found for domain (invalid email)");
    return null;
  }

  const normalizedDomain = normalizeEmailDomain(domain);
  const { data: school, error } = await admin
    .from("school_accounts")
    .select("id, school_name, plan_type, email_domain")
    .eq("email_domain", normalizedDomain)
    .maybeSingle();

  if (error) {
    console.log("School query error:", error.message);
  }

  console.log("School found:", school);

  if (!school) {
    console.log(`No school found for domain: ${domain}`);
    return null;
  }

  return school as SchoolRow;
}

/**
 * Upsert school plan on user_usage (authenticated client or service role).
 */
export async function upsertSchoolUserUsage(
  supabase: SupabaseClient,
  userId: string,
  school: SchoolRow,
): Promise<boolean> {
  const { error: usageError } = await supabase.from("user_usage").upsert(
    {
      user_id: userId,
      plan_type: school.plan_type,
      generations_limit: -1,
      generations_used: 0,
      reset_date: schoolPlanResetDate(),
    },
    { onConflict: "user_id" },
  );

  if (usageError) {
    console.error("[auth/callback] user_usage upsert error:", usageError.message, usageError.code);
    return false;
  }

  console.log("School plan applied successfully");
  return true;
}

/**
 * Server-only: lookup school by email domain and assign plan on user_usage.
 */
export async function applySchoolPlanForEmail(
  userId: string,
  email: string,
  sessionSupabase?: SupabaseClient,
): Promise<ApplySchoolPlanResult> {
  const admin = getSupabaseServiceRole();
  if (!admin) {
    console.warn("[auth/callback] SUPABASE_SERVICE_ROLE_KEY missing — trying session client only");
  }

  const school = admin
    ? await findSchoolByEmailDomain(admin, email)
    : null;

  if (!school) {
    return { matched: false };
  }

  let applied = false;

  if (sessionSupabase) {
    applied = await upsertSchoolUserUsage(sessionSupabase, userId, school);
  }

  if (!applied && admin) {
    applied = await upsertSchoolUserUsage(admin, userId, school);
  }

  if (!applied) {
    console.error("[auth/callback] School plan could not be applied for user", userId);
    return { matched: false };
  }

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

  const schoolName = String(school.school_name);
  return {
    matched: true,
    schoolName,
    welcomeMessage: buildSchoolWelcomeMessage(schoolName),
  };
}
