"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { resolveLessonTitle } from "@/lib/lesson-plan";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/animate";

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
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-stone-200 bg-[#FAF6EF] p-5 shadow-sm">
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16" radius={8} />
              <Skeleton className="h-5 w-12" radius={8} />
            </div>
            <Skeleton className="mt-3 h-5 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-[#0E9484]/20 bg-[#FAF6EF] p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-stone-900">Login Required</h2>
        <p className="mt-2 text-sm text-stone-600">
          Please login to access your saved lesson plans.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex rounded-xl bg-[#0E9484] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B6B5F]"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Lesson Plans"
        description={
          plans.length > 0
            ? `${plans.length} saved plan${plans.length === 1 ? "" : "s"} — lesson plans are saved automatically after generation.`
            : "Lesson plans are saved automatically after each generation."
        }
        actions={
          <Link
            href="/lesson-plan"
            className="shrink-0 rounded-xl bg-[#0E9484] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B6B5F]"
          >
            + New Lesson
          </Link>
        }
      />

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      ) : null}

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#0E9484]/30 bg-[#0E9484]/5 p-6 text-center">
          <p className="text-2xl">📚</p>
          <p className="mt-2 text-sm font-medium text-stone-700">No saved lesson plans yet</p>
          <p className="mt-1 text-xs text-stone-500">
            Generate a lesson plan and it will appear here automatically.
          </p>
          <Link
            href="/lesson-plan"
            className="mt-4 inline-flex rounded-xl bg-[#0E9484] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0B6B5F]"
          >
            Generate your first lesson
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
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
                  className="flex flex-col rounded-2xl border border-stone-200 bg-[#FAF6EF] p-5 shadow-sm transition hover:border-[#0E9484]/40 hover:shadow-md"
                >
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-lg bg-[#0E9484]/10 px-2.5 py-0.5 text-xs font-semibold text-[#0B6B5F]">
                      {plan.subject}
                    </span>
                    <span className="inline-flex items-center rounded-lg bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                      {plan.grade}
                    </span>
                    {plan.curriculum ? (
                      <span className="inline-flex items-center rounded-lg bg-[#F1E9DC] px-2.5 py-0.5 text-xs font-medium text-[#0B6B5F]">
                        {plan.curriculum}
                      </span>
                    ) : null}
                  </div>

                  {/* Topic */}
                  <p className="mt-3 text-base font-semibold leading-snug text-stone-900">
                    {resolveLessonTitle(plan.topic, null, plan.subject)}
                  </p>

                  {/* Date */}
                  <p className="mt-2 text-xs text-stone-400">
                    {dateStr} at {timeStr}
                  </p>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/my-lesson-plans/${plan.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E9484] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0B6B5F]"
                    >
                      📖 View Lesson
                    </Link>
                    {hasPpt ? (
                      <Link
                        href={`/lesson-plan?subject=${encodeURIComponent(plan.subject)}&grade=${encodeURIComponent(plan.grade)}&topic=${encodeURIComponent(plan.topic)}&learningObjectives=${encodeURIComponent(plan.learning_objectives ?? "")}&curriculumType=${encodeURIComponent(plan.curriculum)}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-[#FAF6EF] px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
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
    </div>
  );
}
