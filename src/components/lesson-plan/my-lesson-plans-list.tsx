"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { SavedLessonPlan } from "@/lib/lesson-plan";
import { getCurriculumFrameworkLabel, isValidCurriculumFramework } from "@/lib/curriculum-framework";

export function MyLessonPlansList() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [plans, setPlans] = useState<SavedLessonPlan[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadPlansForUser = async (sessionUser: User) => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("lesson_plans")
      .select("*")
      .eq("user_id", sessionUser.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setPlans([]);
    } else {
      setPlans((data ?? []) as SavedLessonPlan[]);
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
      if (event === "INITIAL_SESSION") {
        return;
      }
      await loadPlansForUser(next);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checkingAuth) {
    return (
      <div className="rounded-3xl border border-[#00C6A7]/20 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading your saved lesson plans...
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
        <h2 className="text-2xl font-bold text-slate-900">My Lesson Plans</h2>
        <p className="mt-2 text-sm text-slate-600">
          Open any saved plan and continue editing in the generator.
        </p>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {plans.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-[#00C6A7]/30 bg-[#00C6A7]/5 p-4 text-sm text-slate-500">
            No saved lesson plans yet.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {plans.map((plan) => {
              const fw = plan.curriculum_framework?.trim();
              const frameworkSubtitle =
                fw && isValidCurriculumFramework(fw) && fw.length > 0
                  ? getCurriculumFrameworkLabel(fw)
                  : null;
              return (
              <Link
                key={plan.id}
                href={`/lesson-plan?planId=${plan.id}`}
                className="rounded-2xl border border-[#00C6A7]/20 bg-[#00C6A7]/5 p-4 text-left transition hover:border-[#00C6A7]/50 hover:bg-[#00C6A7]/10"
              >
                <p className="font-semibold text-slate-900">{plan.topic}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {[plan.curriculum_type, plan.subject, plan.grade]
                    .filter(Boolean)
                    .concat(frameworkSubtitle ? [frameworkSubtitle] : [])
                    .join(" · ")}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {plan.learning_objectives}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {new Date(plan.created_at).toLocaleString()}
                </p>
                <p className="mt-2 text-sm font-medium text-[#00C6A7]">Open plan</p>
              </Link>
            );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
