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
import { Field, Select, TextInput } from "@/components/ui/field";
import {
  Badge,
  EmptyState,
  ErrorState,
  Notice,
  Panel,
  Skeleton,
} from "@/components/ui/panel";
import { cn } from "@/lib/utils";

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
    <div className="workspace-page">
      <header className="page-header">
        <div>
          <p className="page-kicker">Your workspace</p>
          <h1 className="page-title">{greeting(new Date())}{name ? `, ${name}` : ""}</h1>
          <p className="page-description">Plan a lesson, build an assessment, or pick up where you left off.</p>
        </div>
        <time className="text-sm text-faint" dateTime={new Date().toISOString()}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</time>
      </header>

      {quotaLow ? <Notice tone={left === 0 ? "danger" : "generated"} className="mb-6">{left === 0 ? "You've used all your generations this month." : `${left} generation${left === 1 ? "" : "s"} left this month.`} <Link href="/pricing" className="font-semibold underline underline-offset-4">View plans</Link></Notice> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <Panel className="overflow-hidden">
          <div className="border-b border-line bg-brand-subtle/40 px-6 py-5">
            <div className="mb-2 flex items-center gap-2 text-brand-text"><Sparkles className="size-5" aria-hidden /><span className="text-sm font-medium">Lesson planner</span></div>
            <h2 className="text-xl font-semibold tracking-tight text-ink">What are you teaching next?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">Start with your class. Add your objectives and choose the materials you need in the next step.</p>
          </div>
          <form onSubmit={start} className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Curriculum" className="sm:col-span-2"><Select value={curriculum} onChange={(e) => setCurriculum(e.target.value)}>{CURRICULUM_TYPE_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.options.map((o) => <option key={o} value={o}>{o}</option>)}</optgroup>)}</Select></Field>
              <Field label="Grade"><Select value={grade} onChange={(e) => setGrade(e.target.value)}>{GRADE_YEAR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
              <Field label="Subject"><Select value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
              <Field label="Chapter or topic" optional className="sm:col-span-2"><TextInput value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="For example, Photosynthesis" /></Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line-subtle pt-5">
              <p className="text-sm text-faint">{seeded ? "Class details from your last lesson." : "Your materials stay together in My lessons."}</p>
              <Button type="submit" size="lg">Continue to lesson <ArrowRight aria-hidden /></Button>
            </div>
          </form>
        </Panel>
        <section className="space-y-3" aria-labelledby="other-tools-title">
          <h2 id="other-tools-title" className="section-heading mb-4">More teaching tools</h2>
          {[
            { href: `/question-paper?${params()}`, title: "Question paper", detail: "Build assessments with a mark scheme, answers, and an optional blueprint.", icon: ClipboardList },
            { href: `/differentiated-worksheets?${params()}`, title: "Worksheet pack", detail: "Adapt one lesson into Foundation, Core, and Extension practice.", icon: Layers3 },
          ].map((tool) => <Link key={tool.href} href={tool.href} className="group block rounded-xl border border-line bg-surface p-5 transition-colors duration-150 hover:border-brand/50 focus-visible:outline-2 focus-visible:outline-brand"><div className="mb-4 flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-lg bg-sunken text-brand-text"><tool.icon className="size-5" aria-hidden /></span>{isFree ? <Badge tone="generated">Pro</Badge> : <ArrowRight className="size-4 text-faint" aria-hidden />}</div><h3 className="font-semibold text-ink">{tool.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{tool.detail}</p></Link>)}
        </section>
      </div>

      <section className="mt-9" aria-labelledby="recent-lessons-title">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 id="recent-lessons-title" className="section-heading">Recent lessons</h2><p className="mt-1 text-sm text-faint">Open a lesson to review, adapt, or download its materials.</p></div><Button variant="outline" render={<Link href="/my-lesson-plans" />}>View library <ArrowRight aria-hidden /></Button></div>
        {lessons === null ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading lessons">{[0,1,2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div> : failed ? <Panel><ErrorState description="Your saved lessons couldn't be loaded." onRetry={() => void load()} /></Panel> : lessons.length === 0 ? <Panel><EmptyState icon={BookOpen} title="Your lesson library starts here" description="Create your first lesson above. Saved materials will be ready whenever you need them." /></Panel> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{lessons.map((lesson) => <Link key={lesson.id} href={`/my-lesson-plans/${lesson.id}`} className={cn("group flex min-w-0 flex-col rounded-xl border border-line bg-surface p-5", "transition-colors duration-150 hover:border-brand/50 focus-visible:outline-2 focus-visible:outline-brand")}><div className="mb-4 flex items-center gap-2"><Badge tone="neutral">{lesson.subject}</Badge><span className="text-sm text-faint">{lesson.grade}</span></div><h3 className="line-clamp-2 font-semibold text-ink">{resolveLessonTitle(lesson.topic, lesson.chapter, lesson.subject)}</h3>{resolveLessonTopicNote(lesson.topic, lesson.chapter) ? <p className="mt-2 line-clamp-2 text-sm text-muted">{resolveLessonTopicNote(lesson.topic, lesson.chapter)}</p> : null}<div className="mt-auto flex items-center justify-between pt-6 text-sm text-faint"><time dateTime={lesson.created_at}>{relativeDay(lesson.created_at)}</time><ArrowRight className="size-4 text-brand-text" aria-hidden /></div></Link>)}</div>}
      </section>
    </div>
  );
}
