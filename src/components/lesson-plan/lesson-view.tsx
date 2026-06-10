"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { TeacherPackageViewer } from "@/components/lesson-plan/teacher-package-viewer";
import type { LessonPlanResult } from "@/lib/lesson-plan";
import { DEFAULT_TEMPLATE_ID as DEFAULT_PPT_THEME_ID } from "@/lib/ppt-template-config";
import { toUserFacingError } from "@/lib/user-facing-errors";

type SavedLesson = {
  id: string;
  user_id: string;
  subject: string;
  grade: string;
  topic: string;
  curriculum: string;
  learning_objectives: string;
  lesson_content: string;
  ppt_content: string;
  created_at: string;
};

export function LessonView({ id }: { id: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [lesson, setLesson] = useState<SavedLesson | null>(null);
  const [lessonPlan, setLessonPlan] = useState<LessonPlanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (!sessionUser) {
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("saved_lessons")
        .select("*")
        .eq("id", id)
        .eq("user_id", sessionUser.id)
        .single();

      if (fetchError || !data) {
        setError(toUserFacingError(fetchError, "lesson-view"));
        setLoading(false);
        return;
      }

      const saved = data as SavedLesson;
      setLesson(saved);

      try {
        const parsed = JSON.parse(saved.lesson_content) as LessonPlanResult;
        setLessonPlan(parsed);
      } catch {
        setError("Could not parse lesson content.");
      }

      setLoading(false);
    };

    void load();
  }, [id]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-[#00C6A7]/20 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading lesson…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-[#00C6A7]/20 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Login Required</h2>
        <p className="mt-2 text-sm text-slate-600">Please login to view your saved lesson plans.</p>
        <Link
          href="/auth"
          className="mt-5 inline-flex rounded-xl bg-[#00C6A7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A8F7A]"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  if (error || !lesson || !lessonPlan) {
    return (
      <div className="space-y-4">
        <Link href="/my-lesson-plans" className="text-sm font-medium text-[#00C6A7] hover:underline">
          ← Back to My Lessons
        </Link>
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error ?? "Lesson not found."}
        </div>
      </div>
    );
  }

  const regenerateUrl =
    `/lesson-plan?subject=${encodeURIComponent(lesson.subject)}` +
    `&grade=${encodeURIComponent(lesson.grade)}` +
    `&topic=${encodeURIComponent(lesson.topic)}` +
    `&learningObjectives=${encodeURIComponent(lesson.learning_objectives ?? "")}` +
    `&curriculumType=${encodeURIComponent(lesson.curriculum)}`;

  const dateStr = new Date(lesson.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Top nav */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/my-lesson-plans"
          className="text-sm font-medium text-[#00C6A7] hover:underline"
        >
          ← Back to My Lessons
        </Link>
        <Link
          href={regenerateUrl}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#00C6A7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A8F7A]"
        >
          Regenerate Lesson
        </Link>
      </div>

      {/* Metadata card */}
      <div className="rounded-3xl border border-[#00C6A7]/20 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">{lesson.topic}</h2>
        <p className="mt-1 text-sm text-slate-500">Saved {dateStr}</p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{lesson.subject}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grade</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{lesson.grade}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Curriculum</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{lesson.curriculum || "—"}</dd>
          </div>
          {lesson.learning_objectives ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Learning Objectives
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                {lesson.learning_objectives}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {/* Lesson content + downloads */}
      <div className="rounded-3xl border border-[#00C6A7]/20 bg-white p-5 shadow-sm sm:p-6 md:p-7">
        <h3 className="text-xl font-semibold text-slate-900">Generated Lesson Package</h3>
        <p className="mt-2 text-sm text-slate-600">
          Preview and download your generated materials below.
        </p>
        <div className="mt-6">
          <TeacherPackageViewer
            lessonPlan={lessonPlan}
            subject={lesson.subject}
            grade={lesson.grade}
            topic={lesson.topic}
            learningObjectives={lesson.learning_objectives ?? ""}
            pptThemeId={DEFAULT_PPT_THEME_ID}
            teacherName={user.email?.split("@")[0]}
          />
        </div>
      </div>
    </div>
  );
}
