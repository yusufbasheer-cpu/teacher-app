import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSchoolPlanType, type SchoolAccountRow } from "@/lib/school-accounts";
import { isSchoolAdminEmail } from "@/lib/school-enrollment-server";
import { firstDayOfNextMonthUtc } from "@/lib/user-usage";

export type SchoolAdminTeacher = {
  userId: string;
  email: string;
  joinedAt: string;
};

export type SchoolAdminDashboard = {
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
    teacherCount: number;
  };
};

async function assertSchoolAdmin(
  adminEmail: string,
): Promise<{ admin: SupabaseClient; school: SchoolAccountRow } | null> {
  const school = await isSchoolAdminEmail(adminEmail);
  const admin = getSupabaseServiceRole();
  if (!school || !admin) return null;
  return { admin, school };
}

export async function getSchoolAdminDashboard(
  adminEmail: string,
): Promise<SchoolAdminDashboard | null> {
  const ctx = await assertSchoolAdmin(adminEmail);
  if (!ctx) return null;

  const { admin, school } = ctx;

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
  let totalGenerationsUsedThisMonth = 0;

  if (userIds.length > 0) {
    const { data: usageRows } = await admin
      .from("user_usage")
      .select("user_id, generations_used")
      .in("user_id", userIds);

    for (const row of usageRows ?? []) {
      totalGenerationsUsedThisMonth += Math.max(0, Number(row.generations_used) || 0);
    }
  }

  const teacherList: SchoolAdminTeacher[] = (teachers ?? []).map((t) => ({
    userId: t.user_id as string,
    email: t.email as string,
    joinedAt: t.joined_at as string,
  }));

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
      teacherCount: teacherList.length,
    },
  };
}

export async function removeTeacherFromSchool(
  adminEmail: string,
  teacherUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await assertSchoolAdmin(adminEmail);
  if (!ctx) {
    return { ok: false, message: "You are not authorized to manage this school." };
  }

  const { admin, school } = ctx;

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
