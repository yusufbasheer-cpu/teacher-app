"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { TeacherPackageViewer } from "@/components/lesson-plan/teacher-package-viewer";
import {
  buildDifferentiatedPackSourceText,
  resolveLessonTitle,
  type LessonPlanResult,
} from "@/lib/lesson-plan";
import { writeDiffPackSession } from "@/lib/differentiated-pack-session";
import {
  DEFAULT_TEMPLATE_ID as DEFAULT_PPT_THEME_ID,
  type TemplateId as PptThemeId,
} from "@/lib/ppt-template-config";
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
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [lesson, setLesson] = useState<SavedLesson | null>(null);
  const [lessonPlan, setLessonPlan] = useState<LessonPlanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pptThemeId, setPptThemeId] = useState<PptThemeId>(DEFAULT_PPT_THEME_ID);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[#0E9484]/20 bg-[#FAF6EF] p-6 text-sm text-stone-600 shadow-sm">
          Loading lesson…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[#0E9484]/20 bg-[#FAF6EF] p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-900">Login Required</h2>
          <p className="mt-2 text-sm text-stone-600">Please login to view your saved lesson plans.</p>
          <Link
            href="/login"
            className="mt-5 inline-flex rounded-xl bg-[#0E9484] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B6B5F]"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (error || !lesson || !lessonPlan) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 sm:px-6 lg:px-8">
        <Link href="/my-lesson-plans" className="text-sm font-medium text-[#0E9484] hover:underline">
          ← Back to My Lessons
        </Link>
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error ?? "Lesson not found."}
        </div>
      </div>
    );
  }

  // saved_lessons has no chapter column, so topic (optional at generation
  // time) is the only thing that can be missing here — fall back to subject.
  const displayTitle = resolveLessonTitle(lesson.topic, null, lesson.subject);

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

  const onSaveLessonPlan = async () => {
    setError(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      const payload = {
        user_id: user.id,
        curriculum_type: lesson.curriculum,
        curriculum_framework: "",
        subject: lesson.subject,
        grade: lesson.grade,
        chapter: "",
        topic: displayTitle,
        learning_objectives: lesson.learning_objectives ?? "",
        lesson_plan: lessonPlan,
      };

      if (activePlanId) {
        const { error: updateError } = await supabase
          .from("lesson_plans")
          .update(payload)
          .eq("id", activePlanId)
          .eq("user_id", user.id);
        if (updateError) throw new Error(updateError.message);
        setSuccessMessage("Lesson plan updated successfully.");
      } else {
        const { data, error: insertError } = await supabase
          .from("lesson_plans")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw new Error(insertError.message);
        const newId = (data as { id: string }).id;
        setActivePlanId(newId);
        setSuccessMessage("Lesson plan saved successfully.");
      }
    } catch (err) {
      setError(toUserFacingError(err, "lesson-plan-save"));
    } finally {
      setSaving(false);
    }
  };

  const onSendToDifferentiatedPack = () => {
    setError(null);
    const lessonSourceText = buildDifferentiatedPackSourceText(lessonPlan);
    if (!lessonSourceText.trim()) {
      setError(
        "Your package has no text sections yet. Generate at least one section (for example the lesson plan), then try again.",
      );
      return;
    }
    writeDiffPackSession({
      topic: displayTitle,
      subject: lesson.subject.trim(),
      grade: lesson.grade.trim(),
      learningObjectives: (lesson.learning_objectives ?? "").trim(),
      curriculumType: lesson.curriculum.trim() || undefined,
      lessonSourceText,
    });
    router.push("/differentiated-worksheets");
  };

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        {/* Top nav */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/my-lesson-plans"
            className="text-sm font-medium text-[#0E9484] hover:underline"
          >
            ← Back to My Lessons
          </Link>
          <Link
            href={regenerateUrl}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E9484] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B6B5F]"
          >
            Regenerate Lesson
          </Link>
        </div>

        {/* Metadata card */}
        <div className="rounded-3xl border border-[#0E9484]/20 bg-[#FAF6EF] p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-stone-900">{displayTitle}</h2>
          <p className="mt-1 text-sm text-stone-500">Saved {dateStr}</p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Subject</dt>
              <dd className="mt-1 text-sm font-medium text-stone-900">{lesson.subject}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Grade</dt>
              <dd className="mt-1 text-sm font-medium text-stone-900">{lesson.grade}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Curriculum</dt>
              <dd className="mt-1 text-sm font-medium text-stone-900">{lesson.curriculum || "—"}</dd>
            </div>
            {lesson.learning_objectives ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Learning Objectives
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-stone-900">
                  {lesson.learning_objectives}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        {successMessage ? (
          <div className="rounded-xl border border-[#0E9484]/30 bg-[#0E9484]/5 px-4 py-3 text-sm text-[#0E9484]">
            {successMessage}
          </div>
        ) : null}
      </div>

      {/* Lesson content + downloads */}
      <TeacherPackageViewer
        lessonPlan={lessonPlan}
        subject={lesson.subject}
        grade={lesson.grade}
        topic={displayTitle}
        learningObjectives={lesson.learning_objectives ?? ""}
        pptThemeId={pptThemeId}
        onPptThemeChange={setPptThemeId}
        teacherName={user.email?.split("@")[0]}
        onSave={onSaveLessonPlan}
        saving={saving}
        onSendToDifferentiatedPack={onSendToDifferentiatedPack}
      />
    </div>
  );
}
