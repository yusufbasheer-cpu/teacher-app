"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/panel";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { PageLoader } from "@/components/ui/animate";
import { useErrorToast } from "@/hooks/use-error-toast";
import { TeacherPackageViewer } from "@/components/lesson-plan/teacher-package-viewer";
import {
  buildDifferentiatedPackSourceText,
  resolveLessonTitle,
  resolveLessonTopicNote,
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
  /** May be absent on rows fetched before migration 20260825140000 ran. */
  chapter?: string | null;
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
  const [error, setError] = useErrorToast();
  const [pptThemeId, setPptThemeId] = useState<PptThemeId>(DEFAULT_PPT_THEME_ID);

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
        <div className="rounded-3xl border border-[color-mix(in_oklch,var(--brand)_20%,transparent)] bg-[var(--surface)] p-6 shadow-sm">
          <PageLoader label="Loading lesson…" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[color-mix(in_oklch,var(--brand)_20%,transparent)] bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-ink">Login Required</h2>
          <p className="mt-2 text-sm text-muted">Please login to view your saved lesson plans.</p>
          <Link
            href="/login"
            className="mt-5 inline-flex rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-active)]"
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
        <Link href="/my-lesson-plans" className="text-sm font-medium text-[var(--brand)] hover:underline">
          ← Back to My Lessons
        </Link>
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error ?? "Lesson not found."}
        </div>
      </div>
    );
  }

  const displayTitle = resolveLessonTitle(lesson.topic, lesson.chapter, lesson.subject);
  const displayTopicNote = resolveLessonTopicNote(lesson.topic, lesson.chapter);

  const regenerateUrl =
    `/lesson-plan?subject=${encodeURIComponent(lesson.subject)}` +
    `&grade=${encodeURIComponent(lesson.grade)}` +
    `&topic=${encodeURIComponent(lesson.topic)}` +
    `&chapter=${encodeURIComponent(lesson.chapter ?? "")}` +
    `&learningObjectives=${encodeURIComponent(lesson.learning_objectives ?? "")}` +
    `&curriculumType=${encodeURIComponent(lesson.curriculum)}`;

  const dateStr = new Date(lesson.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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
    <div>
      {/* The package viewer below already titles this lesson and lists what is
          in it, so this is a breadcrumb and the metadata that the viewer does
          NOT show — objectives and when it was saved — rather than a second
          title card repeating subject, grade and curriculum. */}
      <div className="workspace-page !pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/my-lesson-plans"
            className="inline-flex items-center gap-1 text-sm text-faint transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3" aria-hidden />
            My lessons
          </Link>
          <Button variant="outline" size="sm" render={<Link href={regenerateUrl} />}>
            <RotateCw />
            Edit and regenerate
          </Button>
        </div>

        {lesson.learning_objectives || displayTopicNote ? (
          <Disclosure
            className="mt-3"
            title="Lesson details"
            summary={`Saved ${dateStr}`}
          >
            <dl className="space-y-2.5">
              {displayTopicNote ? (
                <div>
                  <dt className="text-sm font-medium text-faint">
                    Topic
                  </dt>
                  <dd className="mt-0.5 text-sm text-ink">{displayTopicNote}</dd>
                </div>
              ) : null}
              {lesson.learning_objectives ? (
                <div>
                  <dt className="text-sm font-medium text-faint">
                    Learning objectives
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {lesson.learning_objectives}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-sm font-medium text-faint">
                  Saved
                </dt>
                <dd className="mt-0.5 text-sm text-ink">{dateStr}</dd>
              </div>
            </dl>
          </Disclosure>
        ) : null}


      </div>

      {/* Lesson content + downloads */}
      <TeacherPackageViewer
        lessonPlan={lessonPlan}
        subject={lesson.subject}
        grade={lesson.grade}
        topic={displayTitle}
        learningObjectives={lesson.learning_objectives ?? ""}
        chapter={lesson.chapter ?? undefined}
        pptThemeId={pptThemeId}
        onPptThemeChange={setPptThemeId}
        teacherName={user.email?.split("@")[0]}
        saved
        onSendToDifferentiatedPack={onSendToDifferentiatedPack}
      />
    </div>
  );
}
