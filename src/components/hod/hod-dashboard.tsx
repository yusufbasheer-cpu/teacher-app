"use client";

import { useState } from "react";
import { BookOpen, Search, Users } from "lucide-react";
import type { HodDashboardData } from "@/lib/hod-server";
import { resolveLessonTitle, resolveLessonTopicNote } from "@/lib/lesson-plan";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function HodDashboard({ data }: { data: HodDashboardData }) {
  const { hod, departmentTeachers, recentLessons, stats } = data;
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const visibleLessons = recentLessons.filter((lesson) => {
    const text = `${resolveLessonTitle(lesson.topic, lesson.chapter, lesson.subject)} ${lesson.subject} ${lesson.grade} ${lesson.teacherEmail}`;
    return text.toLowerCase().includes(search.trim().toLowerCase()) && (!teacherFilter || lesson.teacherEmail === teacherFilter);
  });
  const teacherEmails = Array.from(new Set([...departmentTeachers.map((teacher) => teacher.email), ...recentLessons.map((lesson) => lesson.teacherEmail)]));

  return (
    <div className="space-y-7">
      <header className="page-header !mb-0"><div><p className="page-kicker">Department overview</p><h1 className="page-title">{hod.department}</h1><p className="page-description">Follow your team&apos;s lesson preparation and classroom activity.</p></div></header>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Department teachers", value: String(stats.teacherCount), detail: "Assigned to your department" },
          { label: "Lessons this month", value: String(stats.totalLessonsThisMonth), detail: "Created by your teaching team" },
          { label: "Most active teacher", value: stats.mostActiveTeacher?.email.split("@")[0] ?? "No activity yet", detail: stats.mostActiveTeacher ? `${stats.mostActiveTeacher.generations} generations` : "Activity appears as lessons are created" },
        ].map((stat) => <div key={stat.label} className="rounded-xl border border-line bg-surface p-5"><p className="text-sm text-muted">{stat.label}</p><p className="mt-3 break-words text-2xl font-semibold tracking-tight text-ink">{stat.value}</p><p className="mt-2 text-sm text-faint">{stat.detail}</p></div>)}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line p-5 sm:p-6">
            <h2 className="section-heading">Recent lesson activity</h2><p className="mt-1 text-sm text-muted">Explore the lessons your department is preparing.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1"><Search aria-hidden className="absolute left-3 top-3 size-4 text-faint" /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search department lessons" placeholder="Search topic, subject, or grade" className="min-h-10 w-full rounded-lg border border-line bg-surface py-2 pl-10 pr-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" /></div>
              <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} aria-label="Filter lessons by teacher" className="min-h-10 max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink sm:max-w-48"><option value="">All teachers</option>{teacherEmails.map((email) => <option key={email}>{email}</option>)}</select>
            </div>
          </div>
          {visibleLessons.length > 0 ? <ul className="divide-y divide-line">{visibleLessons.map((lesson) => <li key={lesson.id} className="flex gap-4 p-5 sm:p-6"><div className="mt-1 hidden size-10 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand-text sm:flex"><BookOpen className="size-5" aria-hidden /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-medium text-ink">{resolveLessonTitle(lesson.topic, lesson.chapter, lesson.subject)}</h3><time dateTime={lesson.createdAt} className="shrink-0 text-sm text-faint">{formatDate(lesson.createdAt)}</time></div>{resolveLessonTopicNote(lesson.topic, lesson.chapter) ? <p className="mt-1 text-sm text-muted">{resolveLessonTopicNote(lesson.topic, lesson.chapter)}</p> : null}<p className="mt-2 text-sm text-muted">{lesson.subject}{lesson.grade ? ` ? ${lesson.grade}` : ""}</p><p className="mt-1 break-all text-sm text-faint">{lesson.teacherEmail}</p></div></li>)}</ul> : <div className="px-6 py-14 text-center"><BookOpen className="mx-auto mb-4 size-8 text-faint" aria-hidden /><p className="font-medium text-ink">{recentLessons.length ? "No matching lessons" : "No lessons yet"}</p><p className="mt-2 text-sm text-muted">{recentLessons.length ? "Try a different search or teacher." : "Department lesson activity will appear here."}</p>{recentLessons.length > 0 && <button type="button" className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-subtle" onClick={() => { setSearch(""); setTeacherFilter(""); }}>Clear filters</button>}</div>}
          {visibleLessons.length > 0 ? <p className="border-t border-line px-6 py-4 text-sm text-faint">Showing {visibleLessons.length} of {recentLessons.length} recent lessons</p> : null}
        </section>

        <aside className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line p-5"><div className="flex items-center gap-2"><Users className="size-5 text-brand-text" aria-hidden /><h2 className="section-heading">Your teaching team</h2></div><p className="mt-2 text-sm leading-6 text-muted">Department assignments are managed by your school administrator.</p></div>
          {departmentTeachers.length > 0 ? <ul className="divide-y divide-line">{departmentTeachers.map((teacher) => <li key={teacher.userId} className="p-5"><p className="break-all text-sm font-medium text-ink">{teacher.email}</p><div className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-muted"><span>{teacher.generationsUsedThisMonth} lessons this month</span>{teacher.joinedAt ? <span className="text-faint">Joined {formatDate(teacher.joinedAt)}</span> : null}</div></li>)}</ul> : <p className="p-6 text-sm leading-6 text-muted">No teachers are assigned yet. Your school administrator can add teachers to {hod.department}.</p>}
        </aside>
      </div>
    </div>
  );
}
