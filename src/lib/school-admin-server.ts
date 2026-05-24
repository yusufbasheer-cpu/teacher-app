import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSchoolPlanType, type SchoolAccountRow } from "@/lib/school-accounts";
import { firstDayOfNextMonthUtc } from "@/lib/user-usage";

export type SchoolAdminTeacher = {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  generationsUsedThisMonth: number;
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
    .eq("admin_email", normalized)
    .maybeSingle();

  if (error) {
    console.error("[school-admin] school_accounts lookup failed:", error.message);
    return null;
  }

  if (!data || !isSchoolPlanType(data.plan_type)) {
    return null;
  }

  return data as SchoolAccountRow;
}

export async function isUserSchoolAdmin(adminEmail: string): Promise<boolean> {
  const school = await findSchoolForAdmin(adminEmail);
  return Boolean(school);
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

export async function getSchoolAdminDashboard(
  adminEmail: string,
): Promise<SchoolAdminDashboardData | null> {
  const school = await findSchoolForAdmin(adminEmail);
  if (!school) return null;

  const admin = getSupabaseServiceRole();
  if (!admin) return null;

  const { data: teachers, error: teachersError } = await admin
    .from("school_teachers")
    .select("user_id, email, joined_at")
    .eq("school_account_id", school.id)
    .order("joined_at", { ascending: true });

  if (teachersError) {
    console.error("[school-admin] list teachers failed:", teachersError.message);
    return null;
  }

  const userIds = (teachers ?? []).map((t) => t.user_id as string);
  const usageByUser = new Map<string, number>();

  if (userIds.length > 0) {
    const { data: usageRows } = await admin
      .from("user_usage")
      .select("user_id, generations_used")
      .in("user_id", userIds);

    for (const row of usageRows ?? []) {
      usageByUser.set(row.user_id as string, Math.max(0, Number(row.generations_used) || 0));
    }
  }

  const teacherList: SchoolAdminTeacher[] = await Promise.all(
    (teachers ?? []).map(async (t) => {
      const uid = t.user_id as string;
      const email = t.email as string;
      return {
        userId: uid,
        name: await resolveTeacherName(admin, uid, email),
        email,
        joinedAt: t.joined_at as string,
        generationsUsedThisMonth: usageByUser.get(uid) ?? 0,
      };
    }),
  );

  let totalGenerationsUsedThisMonth = 0;
  let mostActive: SchoolAdminDashboardData["usage"]["mostActiveTeacher"] = null;

  for (const teacher of teacherList) {
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
    teachers: teacherList,
    usage: {
      totalGenerationsUsedThisMonth,
      mostActiveTeacher: mostActive,
    },
  };
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
    .eq("school_account_id", school.id)
    .eq("user_id", teacherUserId)
    .maybeSingle();

  if (!membership) {
    return { ok: false, message: "Teacher is not in your school account." };
  }

  const { error: deleteError } = await admin
    .from("school_teachers")
    .delete()
    .eq("school_account_id", school.id)
    .eq("user_id", teacherUserId);

  if (deleteError) {
    console.error("[school-admin] remove teacher failed:", deleteError.message);
    return { ok: false, message: "Could not remove teacher. Please try again." };
  }

  const resetDate = firstDayOfNextMonthUtc();
  const { error: usageError } = await admin
    .from("user_usage")
    .update({
      plan_type: "free",
      generations_limit: 3,
      reset_date: resetDate,
    })
    .eq("user_id", teacherUserId);

  if (usageError) {
    console.error("[school-admin] reset teacher usage failed:", usageError.message);
  }

  return { ok: true };
}
