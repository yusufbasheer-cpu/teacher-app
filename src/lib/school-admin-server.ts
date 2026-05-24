import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSchoolAdminEmail } from "@/lib/school-enrollment-server";
import { isSchoolPlanType, type SchoolAccountRow } from "@/lib/school-accounts";
import { firstDayOfNextMonthUtc } from "@/lib/user-usage";

export type SchoolAdminTeacher = {
  userId: string;
  email: string;
  joinedAt: string;
  generationsUsed: number;
  generationsLimit: number;
  lessonPlansCount: number;
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
    totalGenerationsUsed: number;
    totalLessonPlans: number;
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
  const usageByUser = new Map<string, { generations_used: number; generations_limit: number }>();
  const lessonCountByUser = new Map<string, number>();

  if (userIds.length > 0) {
    const { data: usageRows } = await admin
      .from("user_usage")
      .select("user_id, generations_used, generations_limit")
      .in("user_id", userIds);

    for (const row of usageRows ?? []) {
      usageByUser.set(row.user_id as string, {
        generations_used: row.generations_used as number,
        generations_limit: row.generations_limit as number,
      });
    }

    const { data: lessonRows } = await admin
      .from("lesson_plans")
      .select("user_id")
      .in("user_id", userIds);

    for (const row of lessonRows ?? []) {
      const uid = row.user_id as string;
      lessonCountByUser.set(uid, (lessonCountByUser.get(uid) ?? 0) + 1);
    }
  }

  const teacherList: SchoolAdminTeacher[] = (teachers ?? []).map((t) => {
    const uid = t.user_id as string;
    const usage = usageByUser.get(uid);
    return {
      userId: uid,
      email: t.email as string,
      joinedAt: t.joined_at as string,
      generationsUsed: usage?.generations_used ?? 0,
      generationsLimit: usage?.generations_limit ?? 0,
      lessonPlansCount: lessonCountByUser.get(uid) ?? 0,
    };
  });

  const totalGenerationsUsed = teacherList.reduce((sum, t) => sum + t.generationsUsed, 0);
  const totalLessonPlans = teacherList.reduce((sum, t) => sum + t.lessonPlansCount, 0);

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
      totalGenerationsUsed,
      totalLessonPlans,
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

export async function adminManagesAnySchool(adminEmail: string): Promise<boolean> {
  const school = await isSchoolAdminEmail(adminEmail);
  return Boolean(school && isSchoolPlanType(school.plan_type));
}
