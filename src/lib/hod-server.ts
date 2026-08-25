import { getSupabaseServiceRole } from "@/lib/supabase-admin";

export type HodTeacherRow = {
  userId: string;
  email: string;
  schoolId: string;
  department: string;
};

export type DepartmentTeacher = {
  userId: string;
  email: string;
  generationsUsedThisMonth: number;
  joinedAt: string;
};

export type DepartmentLesson = {
  id: string;
  teacherEmail: string;
  subject: string;
  grade: string;
  topic: string;
  /** May be absent on rows fetched before migration 20260825140000 ran. */
  chapter: string | null;
  createdAt: string;
};

export type HodDashboardData = {
  hod: HodTeacherRow;
  departmentTeachers: DepartmentTeacher[];
  recentLessons: DepartmentLesson[];
  stats: {
    totalLessonsThisMonth: number;
    teacherCount: number;
    mostActiveTeacher: { email: string; generations: number } | null;
  };
};

/** Returns the HOD row if the user has role='hod', otherwise null. */
export async function getHodTeacherRow(userId: string): Promise<HodTeacherRow | null> {
  const admin = getSupabaseServiceRole();
  if (!admin) return null;

  const { data, error } = await admin
    .from("school_teachers")
    .select("user_id, email, school_id, department, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  if ((data.role as string) !== "hod") return null;
  if (!data.department) return null;

  return {
    userId: data.user_id as string,
    email: data.email as string,
    schoolId: data.school_id as string,
    department: data.department as string,
  };
}

export async function getHodDashboard(hod: HodTeacherRow): Promise<HodDashboardData> {
  const admin = getSupabaseServiceRole()!;

  // All teachers in same school + department
  const { data: rawTeachers } = await admin
    .from("school_teachers")
    .select("user_id, email, generations_used_this_month, joined_at")
    .eq("school_id", hod.schoolId)
    .eq("department", hod.department)
    .order("email", { ascending: true });

  const departmentTeachers: DepartmentTeacher[] = (rawTeachers ?? []).map((t) => ({
    userId: t.user_id as string,
    email: t.email as string,
    generationsUsedThisMonth: Math.max(0, Number(t.generations_used_this_month) || 0),
    joinedAt: t.joined_at as string,
  }));

  const teacherUserIds = departmentTeachers.map((t) => t.userId);
  const emailByUserId = new Map(departmentTeachers.map((t) => [t.userId, t.email]));

  // Recent saved_lessons for dept teachers
  let recentLessons: DepartmentLesson[] = [];
  if (teacherUserIds.length > 0) {
    let lessons: Record<string, unknown>[] | null = null;
    let lessonsError: { message: string } | null = null;

    const withChapter = await admin
      .from("saved_lessons")
      .select("id, user_id, subject, grade, topic, chapter, created_at")
      .in("user_id", teacherUserIds)
      .order("created_at", { ascending: false })
      .limit(20);
    lessons = withChapter.data;
    lessonsError = withChapter.error;

    // saved_lessons.chapter is a newly added column (migration
    // 20260825140000) — until it's run on the live DB, fall back to the
    // old column list rather than the department's recent lessons going
    // silently empty.
    if (lessonsError && /column .*chapter.* does not exist|could not find.*chapter/i.test(lessonsError.message)) {
      const withoutChapter = await admin
        .from("saved_lessons")
        .select("id, user_id, subject, grade, topic, created_at")
        .in("user_id", teacherUserIds)
        .order("created_at", { ascending: false })
        .limit(20);
      lessons = withoutChapter.data;
      lessonsError = withoutChapter.error;
    }

    recentLessons = (lessons ?? []).map((l) => ({
      id: l.id as string,
      teacherEmail: emailByUserId.get(l.user_id as string) ?? (l.user_id as string),
      subject: l.subject as string,
      grade: l.grade as string,
      topic: l.topic as string,
      chapter: (l as { chapter?: string | null }).chapter ?? null,
      createdAt: l.created_at as string,
    }));
  }

  // Stats
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const totalLessonsThisMonth = recentLessons.filter(
    (l) => new Date(l.createdAt) >= startOfMonth,
  ).length;

  const mostActiveTeacher = departmentTeachers.reduce<{ email: string; generations: number } | null>(
    (best, t) => {
      if (!best || t.generationsUsedThisMonth > best.generations) {
        return { email: t.email, generations: t.generationsUsedThisMonth };
      }
      return best;
    },
    null,
  );

  return {
    hod,
    departmentTeachers,
    recentLessons,
    stats: {
      totalLessonsThisMonth,
      teacherCount: departmentTeachers.length,
      mostActiveTeacher: mostActiveTeacher?.generations ? mostActiveTeacher : null,
    },
  };
}
