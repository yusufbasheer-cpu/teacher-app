"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  ArrowUpDown,
  BookOpen,
  Plus,
  RotateCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveLessonTitle, resolveLessonTopicNote } from "@/lib/lesson-plan";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { useErrorToast } from "@/hooks/use-error-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageTitle,
  Panel,
  SkeletonRows,
} from "@/components/ui/panel";

/**
 * The lesson library.
 *
 * Was a two-column card grid with emoji buttons (📖 View / 📊 Regenerate /
 * 🗑 Delete) and no search, filter or sort — workable at three lessons and
 * unusable at sixty, which is where a teacher lands after a term. Delete fired
 * immediately, with no confirmation and no undo.
 *
 * Now a workspace: instant search, subject and grade filters, sortable, with
 * row actions that appear on hover and stay permanently visible on touch
 * (where there is no hover to reveal them). Filtering is client-side because
 * the whole set is already loaded and small — a round-trip per keystroke would
 * add latency for nothing.
 */

type SavedLesson = {
  id: string;
  user_id: string;
  subject: string;
  grade: string;
  topic: string;
  chapter?: string | null;
  curriculum: string;
  learning_objectives: string;
  lesson_content: string;
  ppt_content: string;
  created_at: string;
};

type Sort = "recent" | "oldest" | "title";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Dropdown-free filter: a row of chips, because the option counts are small
 *  and a chip shows both what is available and what is active in one glance. */
function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  if (options.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={label}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : opt)}
            className={cn(
              "rounded-sm border px-1.5 py-0.5 text-[11px] font-medium transition-colors duration-[110ms]",
              active
                ? "border-brand bg-brand-subtle text-brand-text"
                : "border-line-subtle bg-surface text-faint hover:border-line hover:text-muted",
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function MyLessonPlansList() {
  const router = useRouter();
  const [user, setUser] = React.useState<User | null>(null);
  const [plans, setPlans] = React.useState<SavedLesson[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [, setError] = useErrorToast();

  const [query, setQuery] = React.useState("");
  const [subject, setSubject] = React.useState<string | null>(null);
  const [grade, setGrade] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<Sort>("recent");

  const [pendingDelete, setPendingDelete] = React.useState<SavedLesson | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const searchRef = React.useRef<HTMLInputElement>(null);

  const loadFor = React.useCallback(
    async (sessionUser: User) => {
      setFailed(false);
      const { data, error } = await supabase
        .from("saved_lessons")
        .select("*")
        .eq("user_id", sessionUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        setError(toUserFacingError(error, "my-lesson-plans"));
        setFailed(true);
        setPlans([]);
        return;
      }
      setPlans((data ?? []) as SavedLesson[]);
    },
    [setError],
  );

  React.useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (!sessionUser) {
        setPlans([]);
        return;
      }
      await loadFor(sessionUser);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const next = session?.user ?? null;
      setUser(next);
      if (!next) {
        setPlans([]);
        return;
      }
      if (event === "INITIAL_SESSION") return;
      await loadFor(next);
    });

    return () => subscription.unsubscribe();
  }, [loadFor]);

  /* `/` focuses search — the convention for a list view, and the fastest way
     into a library you already know the contents of. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const subjects = React.useMemo(
    () => Array.from(new Set((plans ?? []).map((p) => p.subject).filter(Boolean))).sort(),
    [plans],
  );
  const grades = React.useMemo(
    () => Array.from(new Set((plans ?? []).map((p) => p.grade).filter(Boolean))).sort(),
    [plans],
  );

  const visible = React.useMemo(() => {
    let out = plans ?? [];
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((p) =>
        `${p.topic ?? ""} ${p.chapter ?? ""} ${p.subject} ${p.grade} ${p.curriculum ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    if (subject) out = out.filter((p) => p.subject === subject);
    if (grade) out = out.filter((p) => p.grade === grade);

    const sorted = [...out];
    if (sort === "recent") {
      sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sort === "oldest") {
      sorted.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    } else {
      sorted.sort((a, b) =>
        resolveLessonTitle(a.topic, a.chapter, a.subject).localeCompare(
          resolveLessonTitle(b.topic, b.chapter, b.subject),
        ),
      );
    }
    return sorted;
  }, [plans, query, subject, grade, sort]);

  const confirmDelete = async () => {
    if (!pendingDelete || !user) return;
    setDeleting(true);
    const { error } = await supabase
      .from("saved_lessons")
      .delete()
      .eq("id", pendingDelete.id)
      .eq("user_id", user.id);
    setDeleting(false);

    if (error) {
      setError(toUserFacingError(error, "my-lesson-plans-delete"));
      setPendingDelete(null);
      return;
    }
    setPlans((prev) => (prev ?? []).filter((p) => p.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  const filtersActive = Boolean(query.trim() || subject || grade);
  const clearFilters = () => {
    setQuery("");
    setSubject(null);
    setGrade(null);
  };

  const total = plans?.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-6 sm:px-6 sm:py-8">
      <PageTitle
        title="My lessons"
        description={
          total > 0
            ? `${total} saved lesson${total === 1 ? "" : "s"}. Every generation is saved here automatically.`
            : undefined
        }
        actions={
          <Button size="lg" onClick={() => router.push("/lesson-plan")}>
            <Plus />
            New lesson
          </Button>
        }
      />

      {/* ---- Toolbar ---- */}
      {total > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-[280px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint"
              aria-hidden
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lessons"
              aria-label="Search lessons"
              className={cn(
                "h-8 w-full rounded-md border border-line bg-surface pl-8 pr-7 text-[13px] text-ink",
                "transition-colors placeholder:text-disabled hover:border-line-strong",
                "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25",
              )}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xs p-0.5 text-faint hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <FilterChips label="Subject" options={subjects} value={subject} onChange={setSubject} />
          <FilterChips label="Grade" options={grades} value={grade} onChange={setGrade} />

          <div className="ml-auto flex items-center gap-1.5">
            {filtersActive ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
            <label className="sr-only" htmlFor="lesson-sort">
              Sort lessons
            </label>
            <div className="relative">
              <ArrowUpDown
                className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-faint"
                aria-hidden
              />
              <select
                id="lesson-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className={cn(
                  "h-7 cursor-pointer appearance-none rounded-md border border-line-subtle bg-surface",
                  "pl-7 pr-2 text-[12px] text-muted transition-colors hover:border-line",
                  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25",
                )}
              >
                <option value="recent">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="title">A–Z</option>
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---- List ---- */}
      <Panel className="mt-4 overflow-hidden">
        {plans === null ? (
          <SkeletonRows rows={5} />
        ) : failed ? (
          <ErrorState
            description="Your lessons couldn't be loaded."
            onRetry={() => user && void loadFor(user)}
          />
        ) : total === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No lessons yet"
            description="Generate a lesson plan and it appears here automatically, with its slides, worksheet and assessment."
            action={
              <Button onClick={() => router.push("/lesson-plan")}>
                <Plus />
                Generate your first lesson
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            icon={Search}
            title="No lessons match"
            description={
              query.trim()
                ? `Nothing matches “${query.trim()}”. Try a different search, or clear the filters.`
                : "No lessons match the current filters."
            }
            action={
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line-subtle">
            {visible.map((plan) => {
              const title = resolveLessonTitle(plan.topic, plan.chapter, plan.subject);
              const note = resolveLessonTopicNote(plan.topic, plan.chapter);
              const hasPpt = Boolean(plan.ppt_content?.trim());
              const regenerateHref =
                `/lesson-plan?subject=${encodeURIComponent(plan.subject)}` +
                `&grade=${encodeURIComponent(plan.grade)}` +
                `&topic=${encodeURIComponent(plan.topic ?? "")}` +
                `&chapter=${encodeURIComponent(plan.chapter ?? "")}` +
                `&learningObjectives=${encodeURIComponent(plan.learning_objectives ?? "")}` +
                `&curriculumType=${encodeURIComponent(plan.curriculum ?? "")}`;

              return (
                <li key={plan.id} className="group relative">
                  {/* The row itself is the link, so the whole row is the target
                      rather than a small "View" button inside it. */}
                  <Link
                    href={`/my-lesson-plans/${plan.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-[110ms] hover:bg-hover"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-faint">
                        <span className="sm:hidden">
                          {plan.subject} · {plan.grade}
                        </span>
                        {note ? <span className="truncate">{note}</span> : null}
                      </span>
                    </span>

                    <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                      <Badge tone="neutral">{plan.subject}</Badge>
                      <Badge tone="neutral">{plan.grade}</Badge>
                      {plan.curriculum ? <Badge tone="neutral">{plan.curriculum}</Badge> : null}
                    </span>

                    <time
                      dateTime={plan.created_at}
                      className="hidden w-[92px] shrink-0 text-right font-mono text-[11px] tabular-nums text-disabled md:block"
                    >
                      {formatDate(plan.created_at)}
                    </time>

                    {/* Spacer reserving the action column so rows don't shift
                        when the actions fade in on hover. */}
                    <span className="w-[60px] shrink-0" aria-hidden />
                  </Link>

                  {/* Row actions sit outside the link so they are real buttons,
                      not nested interactive content. Always visible on touch,
                      where there is no hover to reveal them. */}
                  <div
                    className={cn(
                      "absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5",
                      "opacity-100 transition-opacity duration-[110ms]",
                      "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
                    )}
                  >
                    {hasPpt ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Regenerate ${title}`}
                        title="Regenerate with these details"
                        onClick={() => router.push(regenerateHref)}
                      >
                        <RotateCw />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${title}`}
                      title="Delete"
                      className="hover:text-danger-text"
                      onClick={() => setPendingDelete(plan)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {visible.length > 0 && filtersActive ? (
        <p className="mt-2 text-[11px] text-faint">
          Showing {visible.length} of {total}
        </p>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        busy={deleting}
        title="Delete this lesson?"
        description={
          pendingDelete ? (
            <>
              <span className="font-medium text-ink">
                {resolveLessonTitle(
                  pendingDelete.topic,
                  pendingDelete.chapter,
                  pendingDelete.subject,
                )}
              </span>{" "}
              and everything generated with it will be removed. This can&apos;t be undone.
            </>
          ) : null
        }
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
