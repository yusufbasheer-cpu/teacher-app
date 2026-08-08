"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { BookOpen, FileStack, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUserUsage } from "@/hooks/use-user-usage";
import { PLANS } from "@/lib/plans";
import { toUserFacingError } from "@/lib/user-facing-errors";

type SavedLesson = {
  id: string;
  subject: string;
  grade: string;
  topic: string;
  curriculum: string;
  created_at: string;
};

const TEAL = "#00C6A7";
const NAVY = "#0A1628";

export function DashboardOverview() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [lessons, setLessons] = useState<SavedLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { usage, loading: usageLoading } = useUserUsage(Boolean(user));

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setCheckingAuth(false);

      if (!sessionUser) {
        setLoadingLessons(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("saved_lessons")
        .select("id, subject, grade, topic, curriculum, created_at")
        .eq("user_id", sessionUser.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(toUserFacingError(fetchError, "dashboard-overview"));
      } else {
        setLessons((data ?? []) as SavedLesson[]);
      }
      setLoadingLessons(false);
    };

    void init();
  }, []);

  if (checkingAuth) {
    return (
      <div className="rounded-3xl border border-[#00C6A7]/20 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading your dashboard…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-[#00C6A7]/20 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Login required</h2>
        <p className="mt-2 text-sm text-slate-600">Please log in to see your dashboard.</p>
        <Link
          href="/auth"
          className="mt-5 inline-flex rounded-xl bg-[#00C6A7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A8F7A]"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  const planLabel = usage ? PLANS[usage.planType].adminLabel : "—";
  const generationsLeft =
    usage && !usage.unlimited && usage.generationsLimit != null
      ? Math.max(0, usage.generationsLimit - usage.generationsUsed)
      : null;
  const recentLessons = lessons.slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: NAVY }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Your generation activity and saved lessons at a glance.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Sparkles size={18} />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</p>
          </div>
          <p className="mt-3 text-2xl font-bold" style={{ color: NAVY }}>
            {usageLoading ? "…" : planLabel}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Sparkles size={18} />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Generations left this month
            </p>
          </div>
          <p className="mt-3 text-2xl font-bold" style={{ color: NAVY }}>
            {usageLoading ? "…" : usage?.unlimited ? "Unlimited" : (generationsLeft ?? "—")}
          </p>
          {usage && !usage.unlimited && usage.generationsLimit != null ? (
            <p className="mt-1 text-xs text-slate-500">
              {usage.generationsUsed} of {usage.generationsLimit} used
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <BookOpen size={18} />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lessons saved
            </p>
          </div>
          <p className="mt-3 text-2xl font-bold" style={{ color: NAVY }}>
            {loadingLessons ? "…" : lessons.length}
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {/* Lessons table */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">My Lessons</h2>
            <p className="mt-0.5 text-xs text-slate-500">Your most recently generated lessons.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/my-lesson-plans"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              View all
            </Link>
            <Link
              href="/lesson-plan"
              className="rounded-xl bg-[#00C6A7] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0A8F7A]"
            >
              + New Lesson
            </Link>
          </div>
        </div>

        {loadingLessons ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Loading your lessons…</p>
        ) : recentLessons.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <FileStack className="mx-auto text-slate-300" size={28} />
            <p className="mt-2 text-sm font-medium text-slate-700">No saved lesson plans yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Generate a lesson plan and it will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Grade</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {recentLessons.map((lesson) => (
                  <tr key={lesson.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="max-w-xs truncate px-5 py-3 font-medium text-slate-900">{lesson.topic}</td>
                    <td className="px-5 py-3 text-slate-600">{lesson.subject}</td>
                    <td className="px-5 py-3 text-slate-600">{lesson.grade}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {new Date(lesson.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/my-lesson-plans/${lesson.id}`}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-teal-50"
                        style={{ color: TEAL }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
