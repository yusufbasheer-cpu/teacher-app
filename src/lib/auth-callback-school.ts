import type { SupabaseClient } from "@supabase/supabase-js";
import { processSchoolEnrollment } from "@/lib/school-enrollment-server";
import { normalizeEmailDomain } from "@/lib/school-accounts";

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
 * Server-only: domain match, school_teachers row (first login only), plan sync.
 */
export async function applySchoolPlanForEmail(
  userId: string,
  email: string,
  _sessionSupabase?: SupabaseClient,
): Promise<ApplySchoolPlanResult> {
  const result = await processSchoolEnrollment(userId, email);

  if (!result.ok) {
    return { matched: false };
  }

  if (result.individual || !result.schoolName) {
    return { matched: false };
  }

  return {
    matched: true,
    schoolName: result.schoolName,
    welcomeMessage: result.newlyJoined ? result.welcomeMessage : undefined,
  };
}
