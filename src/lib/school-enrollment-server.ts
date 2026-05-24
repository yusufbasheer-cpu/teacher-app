import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import {
  buildSchoolMaxTeachersMessage,
  extractEmailDomain,
  isSchoolPlanType,
  normalizeEmailDomain,
  schoolPlanGenerationsLimit,
  type SchoolAccountRow,
  type SchoolPlanType,
} from "@/lib/school-accounts";
import { firstDayOfNextMonthUtc } from "@/lib/user-usage";

export type SchoolEnrollmentResult =
  | {
      ok: true;
      blocked: false;
      individual: boolean;
      newlyJoined: boolean;
      schoolName?: string;
      planType?: SchoolPlanType;
    }
  | {
      ok: false;
      blocked: true;
      message: string;
    };

export function isGoogleAuthUser(user: User): boolean {
  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers) && providers.includes("google")) {
    return true;
  }
  if (user.app_metadata?.provider === "google") {
    return true;
  }
  return user.identities?.some((identity) => identity.provider === "google") ?? false;
}

async function findSchoolByDomain(
  admin: SupabaseClient,
  domain: string,
): Promise<SchoolAccountRow | null> {
  const normalized = normalizeEmailDomain(domain);
  const { data, error } = await admin
    .from("school_accounts")
    .select("*")
    .eq("email_domain", normalized)
    .maybeSingle();

  if (error) {
    console.error("[school-enrollment] find school by domain failed:", error.message);
    return null;
  }

  if (!data || !isSchoolPlanType(data.plan_type)) return null;
  return data as SchoolAccountRow;
}

async function getTeacherMembership(
  admin: SupabaseClient,
  userId: string,
): Promise<{ school_account_id: string; email: string } | null> {
  const { data, error } = await admin
    .from("school_teachers")
    .select("school_account_id, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[school-enrollment] get membership failed:", error.message);
    return null;
  }

  return data;
}

async function countTeachersInSchool(admin: SupabaseClient, schoolId: string): Promise<number> {
  const { count, error } = await admin
    .from("school_teachers")
    .select("id", { count: "exact", head: true })
    .eq("school_account_id", schoolId);

  if (error) {
    console.error("[school-enrollment] count teachers failed:", error.message);
    return 0;
  }

  return count ?? 0;
}

async function upsertSchoolUsage(
  admin: SupabaseClient,
  userId: string,
  planType: SchoolPlanType,
): Promise<void> {
  const resetDate = firstDayOfNextMonthUtc();
  const generations_limit = schoolPlanGenerationsLimit(planType);

  const { data: existing } = await admin
    .from("user_usage")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("user_usage")
      .update({
        plan_type: planType,
        generations_limit,
      })
      .eq("user_id", userId);

    if (error) {
      console.error("[school-enrollment] update user_usage failed:", error.message);
    }
    return;
  }

  const { error } = await admin.from("user_usage").insert({
    user_id: userId,
    plan_type: planType,
    generations_used: 0,
    generations_limit,
    reset_date: resetDate,
  });

  if (error) {
    console.error("[school-enrollment] insert user_usage failed:", error.message);
  }
}

async function ensureIndividualUsage(admin: SupabaseClient, userId: string): Promise<void> {
  const membership = await getTeacherMembership(admin, userId);
  if (membership) return;

  const { data: existing } = await admin
    .from("user_usage")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return;

  const resetDate = firstDayOfNextMonthUtc();
  const { error } = await admin.from("user_usage").insert({
    user_id: userId,
    plan_type: "free",
    generations_used: 0,
    generations_limit: 3,
    reset_date: resetDate,
  });

  if (error && error.code !== "23505") {
    console.error("[school-enrollment] ensure individual usage failed:", error.message);
  }
}

/**
 * Google sign-in only: match email domain, enforce max_teachers, assign school plan (-1 limit).
 * active_teachers is updated via DB trigger on school_teachers insert/delete.
 */
export async function processSchoolEnrollment(
  userId: string,
  email: string,
  options: { googleOnly: boolean },
): Promise<SchoolEnrollmentResult> {
  const admin = getSupabaseServiceRole();
  if (!admin) {
    console.warn("[school-enrollment] SUPABASE_SERVICE_ROLE_KEY missing — skipping school assignment");
    return { ok: true, blocked: false, individual: true, newlyJoined: false };
  }

  if (!options.googleOnly) {
    await ensureIndividualUsage(admin, userId);
    return { ok: true, blocked: false, individual: true, newlyJoined: false };
  }

  const domain = extractEmailDomain(email);
  if (!domain) {
    await ensureIndividualUsage(admin, userId);
    return { ok: true, blocked: false, individual: true, newlyJoined: false };
  }

  const school = await findSchoolByDomain(admin, domain);
  if (!school) {
    await ensureIndividualUsage(admin, userId);
    return { ok: true, blocked: false, individual: true, newlyJoined: false };
  }

  const existing = await getTeacherMembership(admin, userId);
  if (existing) {
    const { data: memberSchool } = await admin
      .from("school_accounts")
      .select("*")
      .eq("id", existing.school_account_id)
      .maybeSingle();

    if (memberSchool && isSchoolPlanType(memberSchool.plan_type)) {
      await upsertSchoolUsage(admin, userId, memberSchool.plan_type as SchoolPlanType);
      return {
        ok: true,
        blocked: false,
        individual: false,
        newlyJoined: false,
        schoolName: memberSchool.school_name,
        planType: memberSchool.plan_type as SchoolPlanType,
      };
    }
  }

  const teacherCount = await countTeachersInSchool(admin, school.id);
  if (teacherCount >= school.max_teachers) {
    return {
      ok: false,
      blocked: true,
      message: buildSchoolMaxTeachersMessage(school.admin_email),
    };
  }

  const { error: insertError } = await admin.from("school_teachers").insert({
    school_account_id: school.id,
    user_id: userId,
    email: email.trim().toLowerCase(),
  });

  if (insertError) {
    if (insertError.code === "23505") {
      await upsertSchoolUsage(admin, userId, school.plan_type);
      return {
        ok: true,
        blocked: false,
        individual: false,
        newlyJoined: false,
        schoolName: school.school_name,
        planType: school.plan_type,
      };
    }
    console.error("[school-enrollment] insert school_teachers failed:", insertError.message);
    await ensureIndividualUsage(admin, userId);
    return { ok: true, blocked: false, individual: true, newlyJoined: false };
  }

  await upsertSchoolUsage(admin, userId, school.plan_type);

  console.log("[school-enrollment] teacher joined school via Google", {
    userId,
    schoolId: school.id,
    schoolName: school.school_name,
    planType: school.plan_type,
    activeTeachers: school.active_teachers + 1,
  });

  return {
    ok: true,
    blocked: false,
    individual: false,
    newlyJoined: true,
    schoolName: school.school_name,
    planType: school.plan_type,
  };
}

export async function isSchoolAdminEmail(email: string): Promise<SchoolAccountRow | null> {
  const admin = getSupabaseServiceRole();
  if (!admin) return null;

  const normalized = email.trim().toLowerCase();
  const { data, error } = await admin
    .from("school_accounts")
    .select("*")
    .eq("admin_email", normalized)
    .maybeSingle();

  if (error || !data || !isSchoolPlanType(data.plan_type)) return null;
  return data as SchoolAccountRow;
}
