"use client";

import type { HodDashboardData } from "@/lib/hod-server";
import { resolveLessonTitle, resolveLessonTopicNote } from "@/lib/lesson-plan";

const TEAL = "var(--brand)";
const NAVY = "var(--text)";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function shortEmail(email: string): string {
  return email.split("@")[0] ?? email;
}

type StatCardProps = {
  label: string;
  value: string | number;
  sub?: string;
};

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div
      className="rounded-2xl bg-[var(--surface)] p-5 shadow-sm"
      style={{ border: "1px solid color-mix(in oklch, var(--brand) 20%, transparent)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: TEAL }}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold" style={{ color: NAVY }}>
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-xs" style={{ color: "#6B7280" }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

export function HodDashboard({ data }: { data: HodDashboardData }) {
  const { hod, departmentTeachers, recentLessons, stats } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
              HOD Dashboard
            </h1>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ background: TEAL }}
            >
              {hod.department}
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
            Monitor and manage your department&apos;s teaching activity
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Teachers in Department"
          value={stats.teacherCount}
        />
        <StatCard
          label="Lesson Plans This Month"
          value={stats.totalLessonsThisMonth}
        />
        <StatCard
          label="Most Active Teacher"
          value={
            stats.mostActiveTeacher
              ? shortEmail(stats.mostActiveTeacher.email)
              : "—"
          }
          sub={
            stats.mostActiveTeacher
              ? `${stats.mostActiveTeacher.generations} generations`
              : undefined
          }
        />
      </div>

      {/* Department Teachers */}
      <section>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: NAVY }}>
          Teachers in {hod.department}
        </h2>

        {departmentTeachers.length === 0 ? (
          <div
            className="rounded-2xl bg-[var(--surface)] px-6 py-10 text-center shadow-sm"
            style={{ border: "1px solid color-mix(in oklch, var(--brand) 20%, transparent)" }}
          >
            <p className="text-sm" style={{ color: "#6B7280" }}>
              No teachers have been assigned to this department yet.
            </p>
            <p className="mt-1 text-xs" style={{ color: "#9CA3AF" }}>
              The school admin can assign teachers to departments from the School Admin dashboard.
            </p>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-2xl bg-[var(--surface)] shadow-sm"
            style={{ border: "1px solid color-mix(in oklch, var(--brand) 20%, transparent)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#9CA3AF" }}
                  >
                    Teacher
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#9CA3AF" }}
                  >
                    Joined
                  </th>
                  <th
                    className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#9CA3AF" }}
                  >
                    Lessons This Month
                  </th>
                </tr>
              </thead>
              <tbody>
                {departmentTeachers.map((teacher, i) => (
                  <tr
                    key={teacher.userId}
                    style={{
                      borderBottom:
                        i < departmentTeachers.length - 1 ? "1px solid #F9FAFB" : undefined,
                    }}
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-medium" style={{ color: NAVY }}>
                        {teacher.email}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: "#6B7280" }}>
                      {teacher.joinedAt ? formatDate(teacher.joinedAt) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          background:
                            teacher.generationsUsedThisMonth > 0
                              ? "color-mix(in oklch, var(--brand) 12%, transparent)"
                              : "#F3F4F6",
                          color:
                            teacher.generationsUsedThisMonth > 0 ? TEAL : "#9CA3AF",
                        }}
                      >
                        {teacher.generationsUsedThisMonth}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Lesson Plans */}
      <section>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: NAVY }}>
          Recent Lesson Plans
        </h2>

        {recentLessons.length === 0 ? (
          <div
            className="rounded-2xl bg-[var(--surface)] px-6 py-10 text-center shadow-sm"
            style={{ border: "1px solid color-mix(in oklch, var(--brand) 20%, transparent)" }}
          >
            <p className="text-sm" style={{ color: "#6B7280" }}>
              No lesson plans generated yet in this department.
            </p>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-2xl bg-[var(--surface)] shadow-sm"
            style={{ border: "1px solid color-mix(in oklch, var(--brand) 20%, transparent)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#9CA3AF" }}
                  >
                    Topic
                  </th>
                  <th
                    className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide sm:table-cell"
                    style={{ color: "#9CA3AF" }}
                  >
                    Subject / Grade
                  </th>
                  <th
                    className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide md:table-cell"
                    style={{ color: "#9CA3AF" }}
                  >
                    Teacher
                  </th>
                  <th
                    className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#9CA3AF" }}
                  >
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentLessons.map((lesson, i) => (
                  <tr
                    key={lesson.id}
                    style={{
                      borderBottom:
                        i < recentLessons.length - 1 ? "1px solid #F9FAFB" : undefined,
                    }}
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-medium" style={{ color: NAVY }}>
                        {resolveLessonTitle(lesson.topic, lesson.chapter, lesson.subject)}
                      </span>
                      {resolveLessonTopicNote(lesson.topic, lesson.chapter) ? (
                        <span className="block text-xs" style={{ color: "#9CA3AF" }}>
                          Topic: {resolveLessonTopicNote(lesson.topic, lesson.chapter)}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className="hidden px-5 py-3.5 text-sm sm:table-cell"
                      style={{ color: "#6B7280" }}
                    >
                      {lesson.subject}
                      {lesson.grade ? ` · ${lesson.grade}` : ""}
                    </td>
                    <td
                      className="hidden px-5 py-3.5 text-sm md:table-cell"
                      style={{ color: "#6B7280" }}
                    >
                      {lesson.teacherEmail}
                    </td>
                    <td
                      className="px-5 py-3.5 text-right text-sm"
                      style={{ color: "#6B7280" }}
                    >
                      {formatDate(lesson.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
