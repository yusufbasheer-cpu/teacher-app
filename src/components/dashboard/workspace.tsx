"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, BookOpen, ClipboardList, Layers3, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  CURRICULUM_TYPE_GROUPS,
  GRADE_YEAR_OPTIONS,
  SUBJECT_OPTIONS,
  resolveLessonTitle,
  resolveLessonTopicNote,
} from "@/lib/lesson-plan";
import { useUserUsage } from "@/hooks/use-user-usage";
import { useErrorToast } from "@/hooks/use-error-toast";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { isFreePlan } from "@/lib/plans";
import {
  buildLessonParams,
  firstName,
  greeting,
  relativeDay,
  type SavedLesson,
} from "@/lib/workspace-helpers";
import { Button } from "@/components/ui/button";
import { Select, TextInput } from "@/components/ui/field";
import {
  Badge,
  EmptyState,
  ErrorState,
  Notice,
  Panel,
  Skeleton,
} from "@/components/ui/panel";
import { cn } from "@/lib/utils";

/**
 * The dashboard.
 *
 * The old one was the exact pattern the product needed to stop being: three
 * stat cards (Plan / Generations left / Lessons saved) above a table. None of
 * those numbers help a teacher decide anything — "Plan: Free" is a label, not
 * information — and the page's most useful action, starting a lesson, was a
 * small secondary button inside a panel header.
 *
 * This answers the only two questions the screen should: *what do I need to
 * know*, and *what do I do next*. For this user the answer to the second is
 * almost always "make tomorrow's lesson", so that is the page — a composer
 * seeded with the context of the last lesson they made, one field and one
 * click from generating. Quota lives in the top bar and only reappears here
 * when it is actually about to block them.
 */

export function Workspace({ user }: { user: User }) {
  const router = useRouter();
  const { usage } = useUserUsage(true);
  const [lessons, setLessons] = React.useState<SavedLesson[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [, setError] = useErrorToast();

  /* Composer state, seeded from the most recent lesson. */
  const [curriculum, setCurriculum] = React.useState("CBSE/NCERT");
  const [grade, setGrade] = React.useState<string>(GRADE_YEAR_OPTIONS[0]!);
  const [subject, setSubject] = React.useState<string>(SUBJECT_OPTIONS[0]!);
  const [chapter, setChapter] = React.useState("");
  const [seeded, setSeeded] = React.useState(false);

  const load = React.useCallback(async () => {
    setFailed(false);
    const { data, error } = await supabase
      .from("saved_lessons")
      .select("id, subject, grade, topic, chapter, curriculum, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      setError(toUserFacingError(error, "dashboard"));
      setFailed(true);
      setLessons([]);
      return;
    }
    setLessons((data ?? []) as SavedLesson[]);
  }, [user.id, setError]);

  React.useEffect(() => {
    void load();
  }, [load]);

  /* Seed the composer once, from the last lesson — a teacher almost always
     works in the same class context session to session, so defaulting to it
     removes three selects from the common path. */
  React.useEffect(() => {
    if (seeded || !lessons?.length) return;
    const last = lessons[0]!;
    if (last.curriculum) setCurriculum(last.curriculum);
    if (last.grade) setGrade(last.grade);
    if (last.subject) setSubject(last.subject);
    setSeeded(true);
  }, [lessons, seeded]);

  const params = React.useCallback(
    (extra?: Record<string, string>) =>
      buildLessonParams({ curriculum, grade, subject, chapter }, extra),
    [curriculum, grade, subject, chapter],
  );

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/lesson-plan?${params()}`);
  };

  const isFree = Boolean(usage && isFreePlan(usage.planType));
  const left =
    usage && !usage.unlimited && usage.generationsLimit != null
      ? Math.max(0, usage.generationsLimit - usage.generationsUsed)
      : null;
  const quotaLow = left !== null && left <= 3;
  const name = firstName(user);

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-6 sm:py-10">
      {/* ---- Greeting ---- */}
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ink">
          {greeting(new Date())}
          {name ? `, ${name}` : ""}
        </h1>
        <time
          className="font-mono text-[11px] uppercase tracking-wider text-disabled"
          dateTime={new Date().toISOString()}
        >
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </time>
      </div>

      {quotaLow ? (
        <Notice tone={left === 0 ? "danger" : "generated"} className="mb-4">
          {left === 0 ? (
            <>
              You&apos;ve used every generation on your plan this month.{" "}
              <Link href="/pricing" className="font-medium underline underline-offset-2">
                See plans
              </Link>{" "}
              to keep going.
            </>
          ) : (
            <>
              {left} generation{left === 1 ? "" : "s"} left this month.{" "}
              <Link href="/pricing" className="font-medium underline underline-offset-2">
                See plans
              </Link>
            </>
          )}
        </Notice>
      ) : null}

      {/* ---- Start a lesson — the page's reason to exist ---- */}
      <Panel className="overflow-visible shadow-pop">
        <form onSubmit={start} className="p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Sparkles className="size-5 text-brand-text" aria-hidden />
            <h2 className="text-[15px] font-semibold text-ink">Start a lesson</h2>
            {seeded ? (
              <Badge tone="neutral" className="ml-auto">
                Continuing from your last lesson
              </Badge>
            ) : null}
          </div>

          {/* Context row. Kept as three bare selects rather than labelled
              fields: these are almost always already correct, so they should
              read as a setting you can adjust, not a form you must fill. */}
          <div className="grid gap-2 sm:grid-cols-3">
            <Select
              value={curriculum}
              onChange={(e) => setCurriculum(e.target.value)}
              aria-label="Curriculum"
              className="h-10"
            >
              {CURRICULUM_TYPE_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <Select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              aria-label="Grade"
              className="h-10"
            >
              {GRADE_YEAR_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
            <Select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-label="Subject"
              className="h-10"
            >
              {SUBJECT_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row">
            <TextInput
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="Chapter or topic — e.g. Photosynthesis"
              aria-label="Chapter or topic"
              className="h-10 flex-1"
            />
            <Button type="submit" size="xl" className="w-full shrink-0 sm:w-auto">
              Generate lesson plan
              <ArrowRight />
            </Button>
          </div>

          {/* The other two generators, carrying the same context so switching
              tool doesn't mean re-picking the class. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-subtle pt-4">
            <span className="text-[12px] text-faint">Or make</span>
            <Link
              href={`/question-paper?${params()}`}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-brand-text"
            >
              <ClipboardList className="size-3.5" aria-hidden />
              Question paper
              {isFree ? <Badge tone="generated">Pro</Badge> : null}
            </Link>
            <Link
              href={`/differentiated-worksheets?${params()}`}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-brand-text"
            >
              <Layers3 className="size-3.5" aria-hidden />
              Worksheet pack
              {isFree ? <Badge tone="generated">Pro</Badge> : null}
            </Link>
          </div>
        </form>
      </Panel>

      {/* ---- Recent ---- */}
      <section className="mt-8">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink">Recent lessons</h2>
          {lessons && lessons.length > 0 ? (
            <Link
              href="/my-lesson-plans"
              className="text-[12px] font-medium text-muted transition-colors hover:text-brand-text"
            >
              All lessons
            </Link>
          ) : null}
        </div>

        <Panel className="overflow-hidden">
          {lessons === null ? (
            <div className="divide-y divide-line-subtle" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-8 shrink-0 rounded-md" />
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
              ))}
            </div>
          ) : failed ? (
            <ErrorState
              description="Your saved lessons couldn't be loaded."
              onRetry={() => void load()}
            />
          ) : lessons.length === 0 ? (
            <EmptyState
              compact
              icon={Sparkles}
              title="No lessons yet"
              description="Pick a class above and generate your first one — it saves here automatically."
            />
          ) : (
            <ul className="divide-y divide-line-subtle">
              {lessons.map((lesson) => {
                const note = resolveLessonTopicNote(lesson.topic, lesson.chapter);
                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/my-lesson-plans/${lesson.id}`}
                      className={cn(
                        "group flex items-start gap-3 px-4 py-3",
                        "transition-colors duration-[110ms] hover:bg-hover",
                      )}
                    >
                      <span
                        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-line-subtle bg-sunken text-faint"
                        aria-hidden
                      >
                        <BookOpen className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="truncate text-[13px] font-medium text-ink">
                            {resolveLessonTitle(lesson.topic, lesson.chapter, lesson.subject)}
                          </span>
                          <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                            <Badge tone="neutral">{lesson.subject}</Badge>
                            <Badge tone="neutral">{lesson.grade}</Badge>
                          </span>
                        </span>
                        {note ? (
                          <span className="mt-0.5 block truncate text-[11px] text-faint">
                            {note}
                          </span>
                        ) : null}
                      </span>
                      <time
                        dateTime={lesson.created_at}
                        className="mt-0.5 shrink-0 text-right font-mono text-[11px] tabular-nums text-disabled"
                      >
                        {relativeDay(lesson.created_at)}
                      </time>
                      <ArrowRight
                        className="mt-0.5 hidden shrink-0 size-3.5 text-disabled opacity-0 transition-opacity group-hover:opacity-100 sm:block"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}
