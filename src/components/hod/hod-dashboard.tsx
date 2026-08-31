"use client";

import type { HodDashboardData } from "@/lib/hod-server";
import { resolveLessonTitle, resolveLessonTopicNote } from "@/lib/lesson-plan";
import { Badge, EmptyState, Panel } from "@/components/ui/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    <Panel className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-text">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
      {sub ? <p className="mt-1 text-xs text-faint">{sub}</p> : null}
    </Panel>
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
            <h1 className="text-2xl font-bold text-ink">HOD Dashboard</h1>
            <Badge tone="brand" className="rounded-full px-3 py-1 text-xs">
              {hod.department}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-faint">
            Monitor and manage your department&apos;s teaching activity
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Teachers in Department" value={stats.teacherCount} />
        <StatCard label="Lesson Plans This Month" value={stats.totalLessonsThisMonth} />
        <StatCard
          label="Most Active Teacher"
          value={stats.mostActiveTeacher ? shortEmail(stats.mostActiveTeacher.email) : "—"}
          sub={stats.mostActiveTeacher ? `${stats.mostActiveTeacher.generations} generations` : undefined}
        />
      </div>

      {/* Department Teachers */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Teachers in {hod.department}</h2>

        {departmentTeachers.length === 0 ? (
          <Panel>
            <EmptyState
              title="No teachers have been assigned to this department yet."
              description="The school admin can assign teachers to departments from the School Admin dashboard."
            />
          </Panel>
        ) : (
          <Panel className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-line-subtle hover:bg-transparent">
                  <TableHead className="px-5 py-3 text-faint">Teacher</TableHead>
                  <TableHead className="px-5 py-3 text-faint">Joined</TableHead>
                  <TableHead className="px-5 py-3 text-right text-faint">Lessons This Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departmentTeachers.map((teacher) => (
                  <TableRow key={teacher.userId} className="border-line-subtle hover:bg-transparent">
                    <TableCell className="px-5 py-3.5">
                      <span className="font-medium text-ink">{teacher.email}</span>
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-muted">
                      {teacher.joinedAt ? formatDate(teacher.joinedAt) : "—"}
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-right">
                      <Badge tone={teacher.generationsUsedThisMonth > 0 ? "brand" : "neutral"}>
                        {teacher.generationsUsedThisMonth}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </section>

      {/* Recent Lesson Plans */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Recent Lesson Plans</h2>

        {recentLessons.length === 0 ? (
          <Panel>
            <EmptyState title="No lesson plans generated yet in this department." />
          </Panel>
        ) : (
          <Panel className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-line-subtle hover:bg-transparent">
                  <TableHead className="px-5 py-3 text-faint">Topic</TableHead>
                  <TableHead className="hidden px-5 py-3 text-faint sm:table-cell">Subject / Grade</TableHead>
                  <TableHead className="hidden px-5 py-3 text-faint md:table-cell">Teacher</TableHead>
                  <TableHead className="px-5 py-3 text-right text-faint">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLessons.map((lesson) => (
                  <TableRow key={lesson.id} className="border-line-subtle hover:bg-transparent">
                    <TableCell className="px-5 py-3.5 whitespace-normal">
                      <span className="font-medium text-ink">
                        {resolveLessonTitle(lesson.topic, lesson.chapter, lesson.subject)}
                      </span>
                      {resolveLessonTopicNote(lesson.topic, lesson.chapter) ? (
                        <span className="block text-xs text-faint">
                          Topic: {resolveLessonTopicNote(lesson.topic, lesson.chapter)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden px-5 py-3.5 text-muted sm:table-cell">
                      {lesson.subject}
                      {lesson.grade ? ` · ${lesson.grade}` : ""}
                    </TableCell>
                    <TableCell className="hidden px-5 py-3.5 text-muted md:table-cell">
                      {lesson.teacherEmail}
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-right text-muted">
                      {formatDate(lesson.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </section>
    </div>
  );
}
