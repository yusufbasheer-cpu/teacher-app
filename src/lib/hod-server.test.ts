import { afterEach, describe, expect, it, vi } from "vitest";

const getSupabaseServiceRole = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseServiceRole }));

import { getHodDashboard, getHodTeacherRow } from "./hod-server";

afterEach(() => vi.clearAllMocks());

describe("HOD service-role saved lesson scope", () => {
  it("derives the HOD identity from the caller's membership row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        user_id: "hod-a",
        email: "hod@example.test",
        school_account_id: "school-a",
        department: "science",
        role: "hod",
      },
      error: null,
    });
    const eqUser = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: eqUser }));
    getSupabaseServiceRole.mockReturnValue({ from: vi.fn(() => ({ select })) });

    await expect(getHodTeacherRow("hod-a")).resolves.toMatchObject({
      userId: "hod-a",
      schoolId: "school-a",
      department: "science",
    });
    expect(eqUser).toHaveBeenCalledWith("user_id", "hod-a");
  });

  it("queries saved_lessons only for teachers in the HOD's school and department", async () => {
    const teachersOrder = vi.fn().mockResolvedValue({
      data: [
        { user_id: "teacher-a", email: "a@example.test", generations_used_this_month: 1, joined_at: "2026-01-01" },
        { user_id: "teacher-b", email: "b@example.test", generations_used_this_month: 2, joined_at: "2026-01-02" },
      ],
    });
    const departmentEq = vi.fn(() => ({ order: teachersOrder }));
    const schoolEq = vi.fn(() => ({ eq: departmentEq }));
    const teacherSelect = vi.fn(() => ({ eq: schoolEq }));

    const lessonsLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const lessonsOrder = vi.fn(() => ({ limit: lessonsLimit }));
    const lessonsIn = vi.fn(() => ({ order: lessonsOrder }));
    const lessonSelect = vi.fn(() => ({ in: lessonsIn }));

    const from = vi.fn((table: string) => {
      if (table === "school_teachers") return { select: teacherSelect };
      if (table === "saved_lessons") return { select: lessonSelect };
      throw new Error(`Unexpected table: ${table}`);
    });
    getSupabaseServiceRole.mockReturnValue({ from });

    await getHodDashboard({
      userId: "hod-a",
      email: "hod@example.test",
      schoolId: "school-a",
      department: "science",
    });

    expect(schoolEq).toHaveBeenCalledWith("school_account_id", "school-a");
    expect(departmentEq).toHaveBeenCalledWith("department", "science");
    expect(lessonsIn).toHaveBeenCalledWith("user_id", ["teacher-a", "teacher-b"]);
  });
});
