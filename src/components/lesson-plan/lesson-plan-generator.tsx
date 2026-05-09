"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LESSON_PLAN_SECTIONS } from "@/lib/lesson-plan";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type {
  LessonPlanInput,
  LessonPlanResult,
  SavedLessonPlan,
} from "@/lib/lesson-plan";

const initialForm: LessonPlanInput = {
  subject: "",
  grade: "",
  topic: "",
  learningObjectives: "",
};

export function LessonPlanGenerator() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [form, setForm] = useState<LessonPlanInput>(initialForm);
  const [lessonPlan, setLessonPlan] = useState<LessonPlanResult | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    setLoading(true);

    try {
      const response = await fetch("/api/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  const onDownloadPptx = async () => {
    if (!lessonPlan) return;
    setError(null);
    setSuccessMessage(null);
    setDownloading(true);

    try {
      const response = await fetch("/api/lesson-plan/pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.subject,
          grade: form.grade,
          topic: form.topic,
          lessonPlan,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Could not generate PowerPoint.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeTopic = (form.topic || "lesson-plan")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      a.href = url;
      a.download = `${safeTopic || "lesson-plan"}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error occurred.";
      setError(message);
    } finally {
      setDownloading(false);
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
        Signed in as <span className="font-semibold">{user.email}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm md:p-7"
        >
          <h2 className="text-xl font-semibold text-slate-900">Lesson Plan Generator</h2>
          <p className="mt-2 text-sm text-slate-600">
            Fill in class details, then generate a complete AI lesson plan.
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

        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Generating..." : "Generate Lesson Plan"}
        </button>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </form>

        <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm md:p-7">
          <h3 className="text-xl font-semibold text-slate-900">Generated Lesson Plan</h3>
          <p className="mt-2 text-sm text-slate-600">
            Your result appears here in a classroom-ready format.
          </p>

        {!lessonPlan ? (
          <div className="mt-6 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-6 text-sm text-slate-500">
            No lesson plan generated yet.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onSaveLessonPlan}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save Lesson Plan"}
              </button>
              <button
                type="button"
                onClick={onDownloadPptx}
                disabled={downloading}
                className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {downloading ? "Preparing PowerPoint..." : "Download as PowerPoint"}
              </button>
            </div>
            {LESSON_PLAN_SECTIONS.map((section) => (
              <article key={section} className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-800">
                  {section}
                </h4>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {lessonPlan[section]}
                </p>
              </article>
            ))}
          </div>
        )}
        </section>
      </div>

      {successMessage ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {successMessage}
        </div>
      ) : null}
    </div>
  );
}
