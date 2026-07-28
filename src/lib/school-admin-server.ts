import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSchoolPlanType, type SchoolAccountRow } from "@/lib/school-accounts";
import { firstDayOfNextMonthUtc } from "@/lib/user-usage";
import { PLANS } from "@/lib/plans";

export type SchoolAdminTeacher = {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  generationsUsedThisMonth: number;
  role: "teacher" | "hod" | "admin";
  department: string | null;
};

export type SchoolAdminDashboardData = {
  school: {
    id: string;
    name: string;
    planType: string;
    emailDomain: string;
    maxTeachers: number;
    activeTeachers: number;
    adminEmail: string;
  };
  teachers: SchoolAdminTeacher[];
  usage: {
    totalGenerationsUsedThisMonth: number;
    mostActiveTeacher: {
      name: string;
      email: string;
      generationsUsed: number;
    } | null;
  };
};

function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Escape `%` / `_` so ILIKE matches the full email literally (case-insensitive). */
function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Service role only — bypasses RLS for reliable admin_email lookup. */
export async function findSchoolForAdmin(adminEmail: string): Promise<SchoolAccountRow | null> {
  const admin = getSupabaseServiceRole();
  if (!admin) {
    console.error("[school-admin] SUPABASE_SERVICE_ROLE_KEY is not configured");
    return null;
  }

  const normalized = normalizeAdminEmail(adminEmail);
  const { data, error } = await admin
    .from("school_accounts")
    .select("*")
    .ilike("admin_email", escapeIlikePattern(normalized))
    .maybeSingle();

  if (error) {
    console.error("[school-admin] school_accounts lookup failed:", error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  if (!isSchoolPlanType(data.plan_type)) {
    console.error(
      "[school-admin] school found but plan_type is invalid:",
      data.plan_type,
    );
    return null;
  }

  return data as SchoolAccountRow;
}

/** Admin access only — use this for redirects, not full dashboard load success. */
export async function isUserSchoolAdmin(adminEmail: string): Promise<boolean> {
  const school = await findSchoolForAdmin(adminEmail);
  return Boolean(school);
}

function buildDashboardData(
  school: SchoolAccountRow,
  teachers: SchoolAdminTeacher[],
): SchoolAdminDashboardData {
  let totalGenerationsUsedThisMonth = 0;
  let mostActive: SchoolAdminDashboardData["usage"]["mostActiveTeacher"] = null;

  for (const teacher of teachers) {
    totalGenerationsUsedThisMonth += teacher.generationsUsedThisMonth;
    if (
      !mostActive ||
      teacher.generationsUsedThisMonth > mostActive.generationsUsed
    ) {
      mostActive = {
        name: teacher.name,
        email: teacher.email,
        generationsUsed: teacher.generationsUsedThisMonth,
      };
    }
  }

  return {
    school: {
      id: school.id,
      name: school.school_name,
      planType: school.plan_type,
      emailDomain: school.email_domain,
      maxTeachers: school.max_teachers,
      activeTeachers: school.active_teachers,
      adminEmail: school.admin_email,
    },
    teachers,
    usage: {
      totalGenerationsUsedThisMonth,
      mostActiveTeacher: mostActive,
    },
  };
}

function teacherDisplayName(
  email: string,
  metadata: Record<string, unknown> | undefined,
): string {
  const fullName = metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  const name = metadata?.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  const local = email.split("@")[0] ?? "Teacher";
  return local.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function resolveTeacherName(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<string> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (!error && data.user) {
      return teacherDisplayName(email, data.user.user_metadata as Record<string, unknown>);
    }
  } catch {
    /* fall through */
  }
  return teacherDisplayName(email, undefined);
}

async function loadTeachersForSchool(
  admin: SupabaseClient,
  schoolId: string,
): Promise<SchoolAdminTeacher[]> {
  const { data: teachers, error } = await admin
    .from("school_teachers")
    .select("*")
    .eq("school_id", schoolId)
    .order("joined_at", { ascending: true });

  console.log("TEACHERS QUERY RESULT:", JSON.stringify(teachers), "ERROR:", JSON.stringify(error), "schoolId used:", schoolId);

  if (error) {
    console.error("[school-admin] list teachers failed:", error.message);
    return [];
  }

  const userIds = (teachers ?? []).map((t) => t.user_id as string);
  const usageByUser = new Map<string, number>();

  for (const row of teachers ?? []) {
    const uid = row.user_id as string;
    const fromTeacherRow = Number(row.generations_used_this_month);
    if (Number.isFinite(fromTeacherRow)) {
      usageByUser.set(uid, Math.max(0, fromTeacherRow));
    }
  }

  const missingUsageIds = userIds.filter((id) => !usageByUser.has(id));
  if (missingUsageIds.length > 0) {
    const { data: usageRows, error: usageError } = await admin
      .from("user_usage")
      .select("user_id, generations_used")
      .in("user_id", missingUsageIds);

    if (usageError) {
      console.error(
        "[school-admin] usage lookup failed (generations will show as 0):",
        usageError.message,
      );
    }

    for (const row of usageRows ?? []) {
      usageByUser.set(row.user_id as string, Math.max(0, Number(row.generations_used) || 0));
    }
  }

  return Promise.all(
    (teachers ?? []).map(async (t) => {
      const uid = t.user_id as string;
      const email = t.email as string;
      const rawRole = t.role as string | null;
      const role: SchoolAdminTeacher["role"] =
        rawRole === "hod" || rawRole === "admin" ? rawRole : "teacher";
      return {
        userId: uid,
        name: await resolveTeacherName(admin, uid, email),
        email,
        joinedAt: t.joined_at as string,
        generationsUsedThisMonth: usageByUser.get(uid) ?? 0,
        role,
        department: (t.department as string | null) ?? null,
      };
    }),
  );
}

/**
 * Loads dashboard data. Returns null only when the user is not a school admin.
 * Teacher/usage query failures do not deny access.
 */
export async function getSchoolAdminDashboard(
  adminEmail: string,
  existingSchool?: SchoolAccountRow | null,
): Promise<SchoolAdminDashboardData | null> {
  const school = existingSchool ?? (await findSchoolForAdmin(adminEmail));
  console.log("[school-admin] getSchoolAdminDashboard — adminEmail:", adminEmail, "school found:", school ? { id: school.id, name: school.school_name, adminEmail: school.admin_email } : null);
  if (!school) return null;

  const admin = getSupabaseServiceRole();
  if (!admin) {
    console.error(
      "[school-admin] service role missing when loading teachers; returning overview only",
    );
    return buildDashboardData(school, []);
  }

  const teacherList = await loadTeachersForSchool(admin, school.id);
  return buildDashboardData(school, teacherList);
}

export async function updateTeacherRoleInSchool(
  adminEmail: string,
  teacherUserId: string,
  role: "teacher" | "hod" | "admin",
  department: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const school = await findSchoolForAdmin(adminEmail);
  if (!school) {
    return { ok: false, message: "You are not authorized to manage this school." };
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return { ok: false, message: "Server error. Please try again." };
  }

  const { data: membership } = await admin
    .from("school_teachers")
    .select("id")
    .eq("school_id", school.id)
    .eq("user_id", teacherUserId)
    .maybeSingle();

  if (!membership) {
    return { ok: false, message: "Teacher is not in your school account." };
  }

  const { error } = await admin
    .from("school_teachers")
    .update({ role, department: department ?? null })
    .eq("school_id", school.id)
    .eq("user_id", teacherUserId);

  if (error) {
    console.error("[school-admin] update teacher role failed:", error.message);
    return { ok: false, message: "Could not update teacher role. Please try again." };
  }

  console.log("[school-admin] role updated for", teacherUserId, "→", role, department ?? "");
  return { ok: true };
}

export async function removeTeacherFromSchool(
  adminEmail: string,
  teacherUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const school = await findSchoolForAdmin(adminEmail);
  if (!school) {
    return { ok: false, message: "You are not authorized to manage this school." };
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return { ok: false, message: "Could not remove teacher. Please try again." };
  }

  const { data: membership } = await admin
    .from("school_teachers")
    .select("id")
    .eq("school_id", school.id)
    .eq("user_id", teacherUserId)
    .maybeSingle();

  if (!membership) {
    return { ok: false, message: "Teacher is not in your school account." };
  }

  const { error: deleteError } = await admin
    .from("school_teachers")
    .delete()
    .eq("school_id", school.id)
    .eq("user_id", teacherUserId);

  if (deleteError) {
    console.error("[school-admin] remove teacher failed:", deleteError.message);
    return { ok: false, message: "Could not remove teacher. Please try again." };
  }

  const { count } = await admin
    .from("school_teachers")
    .select("id", { count: "exact", head: true })
    .eq("school_id", school.id);

  await admin
    .from("school_accounts")
    .update({ active_teachers: count ?? 0 })
    .eq("id", school.id);

  const resetDate = firstDayOfNextMonthUtc();
  const { error: usageError } = await admin
    .from("user_usage")
    .update({
      plan_type: "free",
      generations_limit: PLANS.free.generationsLimit ?? 15,
      reset_date: resetDate,
    })
    .eq("user_id", teacherUserId);

  if (usageError) {
    console.error("[school-admin] reset teacher usage failed:", usageError.message);
  }

  return { ok: true };
}
