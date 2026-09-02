import type { User } from "@supabase/supabase-js";

/**
 * Pure helpers for the dashboard (`src/components/dashboard/workspace.tsx`),
 * kept in their own side-effect-free module so they're unit-testable without
 * pulling in the Supabase client the component itself initializes at import
 * time.
 */

export type SavedLesson = {
  id: string;
  subject: string;
  grade: string;
  topic: string;
  chapter?: string | null;
  curriculum: string;
  created_at: string;
};

export function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(user: User): string | null {
  const full = (user.user_metadata?.full_name as string | undefined)?.trim();
  if (full) return full.split(/\s+/)[0]!;
  return null;
}

export function relativeDay(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The composer's context, carried as querystring params to every generator
 *  it links to — so switching tool never means re-picking the class. */
export type LessonComposerContext = {
  curriculum: string;
  grade: string;
  subject: string;
  chapter: string;
};

export function buildLessonParams(
  context: LessonComposerContext,
  extra?: Record<string, string>,
): string {
  const p = new URLSearchParams({
    curriculumType: context.curriculum,
    grade: context.grade,
    subject: context.subject,
    ...(context.chapter.trim() ? { chapter: context.chapter.trim() } : {}),
    ...extra,
  });
  return p.toString();
}
