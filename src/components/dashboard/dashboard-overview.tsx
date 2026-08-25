"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import { BookOpen, FileStack, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveLessonTitle } from "@/lib/lesson-plan";
import { useUserUsage } from "@/hooks/use-user-usage";
import { PLANS } from "@/lib/plans";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { PageHeader } from "@/components/layout/page-header";
import { CountUp, PageLoader, Skeleton } from "@/components/ui/animate";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
import { InView } from "@/components/motion-primitives/in-view";

const CARD_CLASS =
  "rounded-2xl border border-[#E8DFD1] bg-white p-5 shadow-[0px_4px_20px_rgba(36,26,18,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0px_8px_28px_rgba(36,26,18,0.09)]";

const cardGroupVariants = {
  container: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
  },
  item: {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.0, 0.0, 0.2, 1] as const } },
  },
};

type SavedLesson = {
  id: string;
  subject: string;
  grade: string;
  topic: string;
  curriculum: string;
  created_at: string;
};

const TEAL = "#0E9484";
const NAVY = "#241A12";

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
      <div className="rounded-3xl border border-[#E8DFD1] bg-white p-6 shadow-[0px_4px_20px_rgba(36,26,18,0.06)]">
        <PageLoader label="Loading your dashboard…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-[#E8DFD1] bg-white p-6 shadow-[0px_4px_20px_rgba(36,26,18,0.06)]">
        <h2 className="text-xl font-semibold text-stone-900">Login required</h2>
        <p className="mt-2 text-sm text-stone-600">Please log in to see your dashboard.</p>
        <Link
          href="/login"
          className="mt-5 inline-flex rounded-xl bg-[#0E9484] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B6B5F]"
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
      <PageHeader
        title="Dashboard"
        description="Your generation activity and saved lessons at a glance."
      />

      {/* Stat cards */}
      <AnimatedGroup variants={cardGroupVariants} className="grid gap-4 sm:grid-cols-3">
        <div className={CARD_CLASS}>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "rgba(14,148,132,0.1)", color: TEAL }}>
              <Sparkles size={18} />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Plan</p>
          </div>
          <p className="mt-3 text-2xl font-bold" style={{ color: NAVY }}>
            {usageLoading ? "…" : planLabel}
          </p>
        </div>

        <div className={CARD_CLASS}>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "rgba(14,148,132,0.1)", color: TEAL }}>
              <Sparkles size={18} />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Generations left this month
            </p>
          </div>
          <p className="mt-3 text-2xl font-bold" style={{ color: NAVY }}>
            {usageLoading ? (
              "…"
            ) : usage?.unlimited ? (
              "Unlimited"
            ) : generationsLeft != null ? (
              <CountUp value={generationsLeft} />
            ) : (
              "—"
            )}
          </p>
          {usage && !usage.unlimited && usage.generationsLimit != null ? (
            <p className="mt-1 text-xs text-stone-500">
              {usage.generationsUsed} of {usage.generationsLimit} used
            </p>
          ) : null}
        </div>

        <div className={CARD_CLASS}>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "rgba(14,148,132,0.1)", color: TEAL }}>
              <BookOpen size={18} />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Lessons saved
            </p>
          </div>
          <p className="mt-3 text-2xl font-bold" style={{ color: NAVY }}>
            {loadingLessons ? "…" : <CountUp value={lessons.length} />}
          </p>
        </div>
      </AnimatedGroup>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {/* Lessons table */}
      <div className="rounded-3xl border border-[#E8DFD1] bg-white shadow-[0px_4px_20px_rgba(36,26,18,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0px_8px_28px_rgba(36,26,18,0.09)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8DFD1] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">My Lessons</h2>
            <p className="mt-0.5 text-xs text-stone-500">Your most recently generated lessons.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/my-lesson-plans"
              className="rounded-xl border border-[#E8DFD1] bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              View all
            </Link>
            <Link
              href="/lesson-plan"
              className="rounded-xl bg-[#0E9484] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0B6B5F]"
            >
              + New Lesson
            </Link>
          </div>
        </div>

        {loadingLessons ? (
          <div className="px-5 py-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-6 border-b border-stone-50 py-3.5 last:border-0">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : recentLessons.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <InView
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              transition={{ duration: 0.3 }}
              once
            >
              <motion.div
                className="mx-auto flex h-fit w-fit items-center justify-center"
                animate={{ opacity: [0.55, 0.85, 0.55], scale: [1, 1.06, 1] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <FileStack className="text-stone-300" size={28} />
              </motion.div>
            </InView>
            <InView
              variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.35, delay: 0.15 }}
              once
            >
              <p className="mt-2 text-sm font-medium text-stone-700">No saved lesson plans yet</p>
              <p className="mt-1 text-xs text-stone-500">
                Generate a lesson plan and it will appear here automatically.
              </p>
            </InView>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Grade</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {recentLessons.map((lesson) => (
                  <tr key={lesson.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                    <td className="max-w-xs truncate px-5 py-3 font-medium text-stone-900">
                      {resolveLessonTitle(lesson.topic, null, lesson.subject)}
                    </td>
                    <td className="px-5 py-3 text-stone-600">{lesson.subject}</td>
                    <td className="px-5 py-3 text-stone-600">{lesson.grade}</td>
                    <td className="px-5 py-3 text-stone-500">
                      {new Date(lesson.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/my-lesson-plans/${lesson.id}`}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 hover:bg-[#0E9484]/10"
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
