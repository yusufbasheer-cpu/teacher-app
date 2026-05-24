import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { buildSchoolWelcomeMessage, normalizeEmailDomain } from "@/lib/school-accounts";
import { firstDayOfNextMonthUtc } from "@/lib/user-usage";

export type ApplySchoolPlanResult = {
  matched: boolean;
  schoolName?: string;
  welcomeMessage?: string;
};

/**
 * Server-only: lookup school by email domain and assign plan on user_usage.
 */
export async function applySchoolPlanForEmail(
  userId: string,
  email: string,
): Promise<ApplySchoolPlanResult> {
  const admin = getSupabaseServiceRole();
  if (!admin) {
    console.warn("[auth/callback] SUPABASE_SERVICE_ROLE_KEY missing");
    return { matched: false };
  }

  const domain = email.split("@")[1]?.trim().toLowerCase();
  console.log("Checking school domain for:", domain);

  if (!domain) {
    console.log("No school found for domain (invalid email)");
    return { matched: false };
  }

  const normalizedDomain = normalizeEmailDomain(domain);
  const { data: school, error } = await admin
    .from("school_accounts")
    .select("*")
    .eq("email_domain", normalizedDomain)
    .maybeSingle();

  if (error) {
    console.log("School query error:", error.message);
  }

  console.log("School found:", school);

  if (!school) {
    console.log(`No school found for domain: ${domain}`);
    return { matched: false };
  }

  const resetDate = firstDayOfNextMonthUtc();
  const { error: usageError } = await admin.from("user_usage").upsert(
    {
      user_id: userId,
      plan_type: school.plan_type,
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

  const schoolName = String(school.school_name);
  return {
    matched: true,
    schoolName,
    welcomeMessage: buildSchoolWelcomeMessage(schoolName),
  };
}
