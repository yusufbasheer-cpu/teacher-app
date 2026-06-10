"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
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

export function MyLessonPlansList() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [plans, setPlans] = useState<SavedLesson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPlansForUser = async (sessionUser: User) => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("saved_lessons")
      .select("*")
      .eq("user_id", sessionUser.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(toUserFacingError(fetchError, "my-lesson-plans"));
      setPlans([]);
    } else {
      setPlans((data ?? []) as SavedLesson[]);
    }
  };

  const deletePlan = async (planId: string) => {
    if (!user) return;
    setDeletingId(planId);
    setError(null);
    const { error: deleteError } = await supabase
      .from("saved_lessons")
      .delete()
      .eq("id", planId)
      .eq("user_id", user.id);
    setDeletingId(null);
    if (deleteError) {
      setError(toUserFacingError(deleteError, "my-lesson-plans-delete"));
    } else {
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    }
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (!sessionUser) {
        setCheckingAuth(false);
        setPlans([]);
        return;
      }

      await loadPlansForUser(sessionUser);
      setCheckingAuth(false);
    };

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const next = session?.user ?? null;
      setUser(next);
      if (!next) {
        setPlans([]);
        setError(null);
        return;
      }
      if (event === "INITIAL_SESSION") return;
      await loadPlansForUser(next);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checkingAuth) {
    return (
      <div className="rounded-3xl border border-[#00C6A7]/20 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading your saved lesson plans…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-[#00C6A7]/20 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Login Required</h2>
        <p className="mt-2 text-sm text-slate-600">
          Please login to access your saved lesson plans.
        </p>
        <Link
          href="/auth"
          className="mt-5 inline-flex rounded-xl bg-[#00C6A7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A8F7A]"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#00C6A7]/20 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
        Signed in as <span className="font-semibold">{user.email}</span>
      </div>

      <section className="rounded-3xl border border-[#00C6A7]/20 bg-white p-6 shadow-sm md:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">My Lesson Plans</h2>
            <p className="mt-1 text-sm text-slate-600">
              {plans.length > 0
                ? `${plans.length} saved plan${plans.length === 1 ? "" : "s"} — lesson plans are saved automatically after generation.`
                : "Lesson plans are saved automatically after each generation."}
            </p>
          </div>
          <Link
            href="/lesson-plan"
            className="shrink-0 rounded-xl bg-[#00C6A7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A8F7A]"
          >
            + New Lesson
          </Link>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : null}

        {plans.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#00C6A7]/30 bg-[#00C6A7]/5 p-6 text-center">
            <p className="text-2xl">📚</p>
            <p className="mt-2 text-sm font-medium text-slate-700">No saved lesson plans yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Generate a lesson plan and it will appear here automatically.
            </p>
            <Link
              href="/lesson-plan"
              className="mt-4 inline-flex rounded-xl bg-[#00C6A7] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0A8F7A]"
            >
              Generate your first lesson
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {plans.map((plan) => {
              const dateStr = new Date(plan.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const timeStr = new Date(plan.created_at).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const isDeleting = deletingId === plan.id;
              const hasPpt = Boolean(plan.ppt_content?.trim());

              return (
                <div
                  key={plan.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#00C6A7]/40 hover:shadow-md"
                >
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-lg bg-[#00C6A7]/10 px-2.5 py-0.5 text-xs font-semibold text-[#0A8F7A]">
                      {plan.subject}
                    </span>
                    <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {plan.grade}
                    </span>
                    {plan.curriculum ? (
                      <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
                        {plan.curriculum}
                      </span>
                    ) : null}
                  </div>

                  {/* Topic */}
                  <p className="mt-3 text-base font-semibold leading-snug text-slate-900">
                    {plan.topic}
                  </p>

                  {/* Date */}
                  <p className="mt-2 text-xs text-slate-400">
                    {dateStr} at {timeStr}
                  </p>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/my-lesson-plans/${plan.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#00C6A7] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0A8F7A]"
                    >
                      📖 View Lesson
                    </Link>
                    {hasPpt ? (
                      <Link
                        href={`/lesson-plan?subject=${encodeURIComponent(plan.subject)}&grade=${encodeURIComponent(plan.grade)}&topic=${encodeURIComponent(plan.topic)}&learningObjectives=${encodeURIComponent(plan.learning_objectives ?? "")}&curriculumType=${encodeURIComponent(plan.curriculum)}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        📊 Regenerate PPT
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => void deletePlan(plan.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      {isDeleting ? "Deleting…" : "🗑 Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
