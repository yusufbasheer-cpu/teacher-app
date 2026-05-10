"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LessonPlanLoadingGame } from "@/components/lesson-plan/lesson-plan-loading-game";
import { TeacherPackageViewer } from "@/components/lesson-plan/teacher-package-viewer";
import type { LessonPlanInput, LessonPlanResult, SavedLessonPlan } from "@/lib/lesson-plan";
import {
  GENERATION_CHECKBOX_LABELS,
  TEACHER_PACKAGE_SECTIONS,
  getGenerationTimeEstimate,
  type TeacherPackageSectionKey,
} from "@/lib/lesson-plan";
import { supabase } from "@/lib/supabase";

const initialForm: LessonPlanInput = {
  subject: "",
  grade: "",
  topic: "",
  learningObjectives: "",
};

function initialSectionSelection(): Record<TeacherPackageSectionKey, boolean> {
  return Object.fromEntries(TEACHER_PACKAGE_SECTIONS.map((k) => [k, true])) as Record<
    TeacherPackageSectionKey,
    boolean
  >;
}

export function LessonPlanGenerator() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [form, setForm] = useState<LessonPlanInput>(initialForm);
  const [lessonPlan, setLessonPlan] = useState<LessonPlanResult | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [sectionSelection, setSectionSelection] =
    useState<Record<TeacherPackageSectionKey, boolean>>(initialSectionSelection);

  const loadPlanById = async (userId: string, planId: string) => {
    const { data, error: loadError } = await supabase
      .from("lesson_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("id", planId)
      .single();

    if (loadError) {
      throw new Error(loadError.message);
    }

    const plan = data as SavedLessonPlan;
    setForm({
      subject: plan.subject,
      grade: plan.grade,
      topic: plan.topic,
      learningObjectives: plan.learning_objectives,
    });
    setLessonPlan(plan.lesson_plan);
    setActivePlanId(plan.id);
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        const planId = searchParams.get("planId");
        if (planId) {
          try {
            await loadPlanById(sessionUser.id, planId);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed loading plan.");
          }
        }
      }
      setCheckingAuth(false);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setActivePlanId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLessonPlan(null);
    setActivePlanId(null);

    const sections = TEACHER_PACKAGE_SECTIONS.filter((k) => sectionSelection[k]);
    if (sections.length === 0) {
      setError("Select at least one item to generate.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sections }),
      });

      const data = (await response.json()) as {
        error?: string;
        lessonPlan?: LessonPlanResult;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate lesson plan.");
      }

      if (!data.lessonPlan) {
        throw new Error("No lesson plan returned.");
      }

      setLessonPlan(data.lessonPlan);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error occurred.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onSaveLessonPlan = async () => {
    if (!user || !lessonPlan) return;
    setError(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      const payload = {
        user_id: user.id,
        subject: form.subject,
        grade: form.grade,
        topic: form.topic,
        learning_objectives: form.learningObjectives,
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
      setError(err instanceof Error ? err.message : "Failed to save lesson plan.");
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="rounded-3xl border border-blue-100 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Checking your account...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Login Required</h2>
        <p className="mt-2 text-sm text-slate-600">
          Please login to generate and save your personal lesson plans.
        </p>
        <Link
          href="/auth"
          className="mt-5 inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  const selectedSectionCount = TEACHER_PACKAGE_SECTIONS.filter((k) => sectionSelection[k]).length;
  const generationEta = getGenerationTimeEstimate(selectedSectionCount);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
        Signed in as <span className="font-semibold">{user.email}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <form
          onSubmit={onSubmit}
          aria-busy={loading}
          className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm md:p-7"
        >
          <h2 className="text-xl font-semibold text-slate-900">Lesson Plan Generator</h2>
          <p className="mt-2 text-sm text-slate-600">
            Fill in class details, choose which materials to generate, then run the AI.
          </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="subject" className="mb-1 block text-sm font-medium text-slate-700">
              Subject
            </label>
            <input
              id="subject"
              type="text"
              value={form.subject}
              onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="e.g. Science"
              required
            />
          </div>

          <div>
            <label htmlFor="grade" className="mb-1 block text-sm font-medium text-slate-700">
              Grade
            </label>
            <input
              id="grade"
              type="text"
              value={form.grade}
              onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="e.g. Grade 7"
              required
            />
          </div>

          <div>
            <label htmlFor="topic" className="mb-1 block text-sm font-medium text-slate-700">
              Topic
            </label>
            <input
              id="topic"
              type="text"
              value={form.topic}
              onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="e.g. Photosynthesis"
              required
            />
          </div>

          <div>
            <label
              htmlFor="objectives"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Learning Objectives
            </label>
            <textarea
              id="objectives"
              value={form.learningObjectives}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, learningObjectives: e.target.value }))
              }
              className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="List key outcomes students should achieve."
              required
            />
          </div>
        </div>

        <fieldset className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">What to generate</legend>
          <p className="mt-1 text-xs text-slate-600">
            Only checked sections are sent to the AI — fewer selections usually means a quicker response.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setSectionSelection(
                  Object.fromEntries(TEACHER_PACKAGE_SECTIONS.map((k) => [k, true])) as Record<
                    TeacherPackageSectionKey,
                    boolean
                  >,
                )
              }
              className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm hover:bg-blue-50"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() =>
                setSectionSelection(
                  Object.fromEntries(TEACHER_PACKAGE_SECTIONS.map((k) => [k, false])) as Record<
                    TeacherPackageSectionKey,
                    boolean
                  >,
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Deselect All
            </button>
          </div>
          <ul className="mt-4 space-y-2.5">
            {TEACHER_PACKAGE_SECTIONS.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <input
                  id={`gen-${key}`}
                  type="checkbox"
                  checked={sectionSelection[key]}
                  onChange={() =>
                    setSectionSelection((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                />
                <label htmlFor={`gen-${key}`} className="text-sm text-slate-800">
                  {GENERATION_CHECKBOX_LABELS[key]}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Estimated time: </span>
          {selectedSectionCount === 0 ? (
            generationEta.detail
          ) : (
            <>
              {generationEta.tier} ({generationEta.detail}) — {selectedSectionCount} item
              {selectedSectionCount === 1 ? "" : "s"} selected
            </>
          )}
        </p>

        <button
          type="submit"
          disabled={loading || TEACHER_PACKAGE_SECTIONS.every((k) => !sectionSelection[k])}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Generating..." : "Generate Lesson Plan"}
        </button>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </form>

        <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm md:p-7">
        <h3 className="text-xl font-semibold text-slate-900">Generated teacher package</h3>
        <p className="mt-2 text-sm text-slate-600">
          Preview and download only the sections you generated (lesson plan, slides, worksheet, and
          more).
        </p>

        {!lessonPlan ? (
          <div className="mt-6 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-6 text-sm text-slate-500">
            No lesson plan generated yet.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <button
              type="button"
              onClick={onSaveLessonPlan}
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {saving ? "Saving..." : "Save Lesson Plan"}
            </button>
            <TeacherPackageViewer
              lessonPlan={lessonPlan}
              subject={form.subject}
              grade={form.grade}
              topic={form.topic}
            />
          </div>
        )}
        </section>
      </div>

      {successMessage ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {successMessage}
        </div>
      ) : null}

      {loading ? <LessonPlanLoadingGame active /> : null}
    </div>
  );
}
