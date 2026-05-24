import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import {
  buildSchoolMaxTeachersMessage,
  buildSchoolWelcomeMessage,
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
      schoolId?: string;
      planType?: SchoolPlanType;
      welcomeMessage?: string;
    }
  | {
      ok: false;
      blocked: true;
      message: string;
    };

async function findSchoolByDomain(
  admin: SupabaseClient,
  domain: string,
): Promise<SchoolAccountRow | null> {
  const normalized = normalizeEmailDomain(domain);

  const { data: exact, error: exactError } = await admin
    .from("school_accounts")
    .select("*")
    .eq("email_domain", normalized)
    .maybeSingle();

  if (exactError) {
    console.error("[school-enrollment] find school by domain failed:", exactError.message);
    return null;
  }

  if (exact && isSchoolPlanType(exact.plan_type)) {
    return exact as SchoolAccountRow;
  }

  const { data: rows, error: listError } = await admin.from("school_accounts").select("*");

  if (listError) {
    console.error("[school-enrollment] list schools failed:", listError.message);
    return null;
  }

  const match = (rows ?? []).find(
    (row) =>
      isSchoolPlanType(row.plan_type) &&
      normalizeEmailDomain(String(row.email_domain)) === normalized,
  );

  return match ? (match as SchoolAccountRow) : null;
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

/** True if this user_id already has a school_teachers row (any school). */
async function hasExistingTeacherRow(admin: SupabaseClient, userId: string): Promise<boolean> {
  const membership = await getTeacherMembership(admin, userId);
  return Boolean(membership);
}

async function syncActiveTeachersCount(admin: SupabaseClient, schoolId: string): Promise<void> {
  const count = await countTeachersInSchool(admin, schoolId);
  const { error } = await admin
    .from("school_accounts")
    .update({ active_teachers: count })
    .eq("id", schoolId);

  if (error) {
    console.error("[school-enrollment] sync active_teachers failed:", error.message);
  }
}

async function syncTeacherGenerationsFromUsage(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: usage } = await admin
    .from("user_usage")
    .select("generations_used")
    .eq("user_id", userId)
    .maybeSingle();

  const used = Math.max(0, Number(usage?.generations_used) || 0);
  const { error } = await admin
    .from("school_teachers")
    .update({ generations_used_this_month: used })
    .eq("user_id", userId);

  if (error) {
    console.error("[school-enrollment] sync generations_used_this_month failed:", error.message);
  }
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

async function storeSchoolOnUserProfile(
  admin: SupabaseClient,
  userId: string,
  school: SchoolAccountRow,
): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      school_id: school.id,
      school_name: school.school_name,
      school_plan_type: school.plan_type,
    },
  });

  if (error) {
    console.error("[school-enrollment] update user profile school_id failed:", error.message);
  }
}

async function ensureSchoolTeacherRow(
  admin: SupabaseClient,
  school: SchoolAccountRow,
  userId: string,
  email: string,
): Promise<{ newlyJoined: boolean }> {
  const existing = await getTeacherMembership(admin, userId);

  if (existing) {
    if (existing.school_account_id === school.id) {
      await syncTeacherGenerationsFromUsage(admin, userId);
      console.log("[school-enrollment] Teacher already in school_teachers — not incrementing", {
        userId,
        schoolId: school.id,
      });
      return { newlyJoined: false };
    }

    console.warn("[school-enrollment] User already belongs to another school", {
      userId,
      existingSchoolId: existing.school_account_id,
      requestedSchoolId: school.id,
    });
    return { newlyJoined: false };
  }

  const teacherCount = await countTeachersInSchool(admin, school.id);
  if (teacherCount >= school.max_teachers) {
    throw new Error("SCHOOL_FULL");
  }

  const { error: insertError } = await admin.from("school_teachers").insert({
    school_account_id: school.id,
    user_id: userId,
    email: email.trim().toLowerCase(),
    generations_used_this_month: 0,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      const alreadyJoined = await hasExistingTeacherRow(admin, userId);
      if (alreadyJoined) {
        await syncTeacherGenerationsFromUsage(admin, userId);
        return { newlyJoined: false };
      }
    }
    console.error("[school-enrollment] insert school_teachers failed:", insertError.message);
    throw insertError;
  }

  await syncActiveTeachersCount(admin, school.id);

  console.log("[school-enrollment] First login — added to school_teachers", {
    userId,
    schoolId: school.id,
    activeTeachers: await countTeachersInSchool(admin, school.id),
  });

  return { newlyJoined: true };
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

function schoolSuccess(
  school: SchoolAccountRow,
  newlyJoined: boolean,
): Extract<SchoolEnrollmentResult, { ok: true }> {
  const welcomeMessage = buildSchoolWelcomeMessage(school.school_name);
  return {
    ok: true,
    blocked: false,
    individual: false,
    newlyJoined,
    schoolName: school.school_name,
    schoolId: school.id,
    planType: school.plan_type,
    welcomeMessage,
  };
}

/**
 * On every Google login: match email domain → school_accounts, sync plan & profile.
 */
export async function processSchoolEnrollment(
  userId: string,
  email: string,
): Promise<SchoolEnrollmentResult> {
  const admin = getSupabaseServiceRole();
  if (!admin) {
    console.warn("[school-enrollment] SUPABASE_SERVICE_ROLE_KEY missing — skipping school assignment");
    return { ok: true, blocked: false, individual: true, newlyJoined: false };
  }

  const trimmedEmail = email.trim().toLowerCase();
  const domain = extractEmailDomain(trimmedEmail);

  console.log("[school-enrollment] Checking domain for user", {
    email: trimmedEmail,
    domain,
  });

  if (!domain) {
    console.log(`No school found for domain (invalid email): ${trimmedEmail}`);
    await ensureIndividualUsage(admin, userId);
    return { ok: true, blocked: false, individual: true, newlyJoined: false };
  }

  const school = await findSchoolByDomain(admin, domain);

  if (!school) {
    console.log(`No school found for domain: ${domain}`);
    await ensureIndividualUsage(admin, userId);
    return { ok: true, blocked: false, individual: true, newlyJoined: false };
  }

  console.log(`School detected for user email: ${trimmedEmail}`, {
    schoolId: school.id,
    schoolName: school.school_name,
    planType: school.plan_type,
  });

  try {
    const { newlyJoined } = await ensureSchoolTeacherRow(admin, school, userId, trimmedEmail);

    await upsertSchoolUsage(admin, userId, school.plan_type);
    await storeSchoolOnUserProfile(admin, userId, school);

    const { data: refreshedSchool } = await admin
      .from("school_accounts")
      .select("*")
      .eq("id", school.id)
      .maybeSingle();

    const schoolRow = (refreshedSchool ?? school) as SchoolAccountRow;

    console.log("[school-enrollment] School teacher synced on login", {
      userId,
      schoolId: school.id,
      newlyJoined,
      activeTeachers: schoolRow.active_teachers,
    });

    return schoolSuccess(schoolRow, newlyJoined);
  } catch (err) {
    if (err instanceof Error && err.message === "SCHOOL_FULL") {
      return {
        ok: false,
        blocked: true,
        message: buildSchoolMaxTeachersMessage(school.admin_email),
      };
    }
    console.error("[school-enrollment] failed to enroll teacher:", err);
    await ensureIndividualUsage(admin, userId);
    return { ok: true, blocked: false, individual: true, newlyJoined: false };
  }
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
