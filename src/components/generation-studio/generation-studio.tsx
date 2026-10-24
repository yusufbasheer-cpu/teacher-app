"use client";

/**
 * Layah Studio: the full-page workspace shown while a teaching resource is generated. One shell for every
 * generator (lesson package, PowerPoint, question paper, worksheet levels); each caller supplies its stages and an
 * artifact-appropriate preview.
 *
 * Honesty rules, shared by every caller: stages come from real signals only (no timers), a count is shown only
 * when the server reports one, and there are no percentages or time estimates.
 *
 * Motion is CSS keyframes on transform/opacity so it stays smooth while the main thread parses a stream.
 * Reduced motion removes movement; every state still reads from its icon and label.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, Download, Lightbulb, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StudioStageStatus = "pending" | "active" | "done" | "warning" | "error";

export type StudioStage = {
  id: string;
  label: string;
  detail?: string;
  status: StudioStageStatus;
  /** A real count reported by the server (for example 7 of 13 lesson components). */
  count?: { done: number; total: number };
};

export type StudioAction = { label: string; onClick: () => void; variant?: "default" | "outline" | "ghost" };

export type StudioOutcome = {
  tone: "ok" | "warn" | "bad";
  title: string;
  detail?: string;
  /** Specific differences or reasons, shown as a short list. */
  notes?: string[];
  actions: StudioAction[];
  /** Individual files that are already in memory, so each click downloads instantly. */
  files?: { label: string; type: string; onClick: () => void }[];
};

type GenerationStudioProps = {
  /** e.g. "Teaching package" / "Presentation" — the small label in the header. */
  kind: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  stages: StudioStage[];
  /** Small facts about the run (theme, slide count). Only real values. */
  meta?: { label: string; value: string }[];
  preview: ReactNode;
  /** Set once generation has finished (successfully or not). */
  outcome?: StudioOutcome | null;
  footerNote?: string;
  /** Light, true classroom facts shown while waiting — kept apart from the preview so they never read as lesson content. */
  tips?: string[];
};

const FUN_FACTS = [
  "Honey never spoils — archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible.",
  "Octopuses have three hearts and blue blood.",
  "A day on Venus is longer than its year: it spins once every 243 Earth days but orbits the Sun in 225.",
  "Bananas are berries, but strawberries aren't.",
  "Sunlight takes about 8 minutes 20 seconds to reach Earth.",
  "Sharks are older than trees — they've been around for over 400 million years.",
  "The Eiffel Tower grows about 15 cm taller in summer as the iron expands in the heat.",
  "A bolt of lightning is around five times hotter than the surface of the Sun.",
  "Wombats are the only animals known to produce cube-shaped droppings.",
  "The word 'school' comes from the Greek skholē, which meant 'leisure'.",
  "The first computer 'bug' was a real moth, found stuck in a Harvard computer in 1947.",
  "There are more possible games of chess than atoms in the observable universe.",
  "Your brain uses about 20% of your body's energy while weighing only around 2% of it.",
  "A group of flamingos is called a flamboyance.",
];

function WhileYouWait({ tips }: { tips: string[] }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * tips.length));
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % tips.length), 9000);
    return () => window.clearInterval(id);
  }, [tips.length]);
  return (
    <div className="mt-3 flex gap-2.5 rounded-lg border border-line-subtle bg-surface px-3 py-2.5">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-gen" aria-hidden />
      <p key={i} className="std-in text-[12px] leading-5 text-muted">
        <span className="font-semibold text-ink">While you wait · </span>
        {tips[i]}
      </p>
    </div>
  );
}

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";


/** The branded "working" mark: three teal dots on a slow orbit, softly breathing. */
export function StudioIndicator({ size = 20, className }: { size?: number; className?: string }) {
  const dot = Math.max(3, Math.round(size / 5));
  return (
    <span aria-hidden className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      <span className="std-orbit absolute inset-0">
        {[0, 120, 240].map((deg, i) => (
          <span
            key={deg}
            className="absolute left-1/2 top-1/2"
            style={{ transform: `rotate(${deg}deg) translateY(-${size / 2 - dot / 2}px)` }}
          >
            <span
              className="std-dot block rounded-full bg-brand"
              style={{ width: dot, height: dot, marginLeft: -dot / 2, marginTop: -dot / 2, animationDelay: `${i * 0.22}s` }}
            />
          </span>
        ))}
      </span>
    </span>
  );
}

function StageIcon({ status }: { status: StudioStageStatus }) {
  if (status === "active") return <span className="flex size-6 items-center justify-center rounded-full bg-surface"><StudioIndicator size={18} /></span>;
  if (status === "done") {
    return (
      <span className="std-scale-in flex size-6 items-center justify-center rounded-full bg-brand text-brand-on">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-gen-subtle text-gen-text ring-1 ring-gen-border">
        <AlertTriangle className="size-3.5" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-danger-subtle text-danger-text ring-1 ring-danger-border">
        <X className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  return <span className="flex size-6 items-center justify-center"><span className="size-2.5 rounded-full border-2 border-line-strong bg-surface" /></span>;
}

const STATUS_WORD: Record<StudioStageStatus, string> = {
  pending: "Up next",
  active: "In progress",
  done: "Done",
  warning: "Needs a look",
  error: "Didn't finish",
};

export function StageTimeline({ stages }: { stages: StudioStage[] }) {
  return (
    <ol className="relative">
      {stages.map((s, i) => (
        <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < stages.length - 1 ? (
            <span
              aria-hidden
              className={cn("absolute left-3 top-7 -bottom-0 w-px -translate-x-1/2", s.status === "done" ? "bg-brand/50" : "bg-line")}
            />
          ) : null}
          <StageIcon status={s.status} />
          <div className={cn("min-w-0 flex-1 rounded-md px-2 py-0.5 -my-0.5", s.status === "active" && "bg-brand-subtle")}>
            <div className="flex items-baseline justify-between gap-2">
              <p
                className={cn(
                  "text-[13px] leading-6",
                  s.status === "active" ? "font-semibold text-ink" : s.status === "pending" ? "text-faint" : "text-ink",
                )}
              >
                {s.label}
                <span className="sr-only"> — {STATUS_WORD[s.status]}</span>
              </p>
              {s.count && s.status === "active" ? (
                <span className="font-mono text-[11px] tabular-nums text-brand-text">
                  {s.count.done}/{s.count.total}
                </span>
              ) : null}
            </div>
            {s.detail && s.status !== "pending" ? (
              <p
                className={cn(
                  "text-[12px] leading-5",
                  s.status === "error" ? "text-danger-text" : s.status === "warning" ? "text-gen-text" : "text-faint",
                )}
              >
                {s.detail}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** One segment per stage. A stage with a real count fills by it; an active one without a count only sweeps. */
function StageProgress({ stages }: { stages: StudioStage[] }) {
  return (
    <div aria-hidden className="flex gap-1">
      {stages.map((s) => {
        const fill =
          s.status === "pending" ? 0 : s.status === "active" ? (s.count && s.count.total > 0 ? s.count.done / s.count.total : 0) : 1;
        const color = s.status === "error" ? "bg-danger" : s.status === "warning" ? "bg-gen" : "bg-brand";
        return (
          <div key={s.id} className="relative h-1 flex-1 overflow-hidden rounded-full bg-line-subtle">
            <div
              className={cn("absolute inset-y-0 left-0 rounded-full", color)}
              style={{ width: `${fill * 100}%`, transition: `width 500ms ${EASE}` }}
            />
            {s.status === "active" ? (
              <div className="std-sweep absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const OUTCOME_STYLE = {
  ok: { ring: "border-brand-border bg-brand-subtle", icon: "bg-brand text-brand-on", Icon: Check },
  warn: { ring: "border-gen-border bg-gen-subtle", icon: "bg-gen text-white", Icon: AlertTriangle },
  bad: { ring: "border-danger-border bg-danger-subtle", icon: "bg-danger text-danger-on", Icon: AlertTriangle },
} as const;

function OutcomeCard({ outcome }: { outcome: StudioOutcome }) {
  const style = OUTCOME_STYLE[outcome.tone];
  const firstAction = useRef<HTMLDivElement>(null);
  useEffect(() => {
    firstAction.current?.querySelector("button")?.focus({ preventScroll: true });
  }, []);
  return (
    <div className={cn("std-in rounded-xl border p-4", style.ring)}>
      <div className="flex items-start gap-3">
        <span className={cn("std-scale-in flex size-8 shrink-0 items-center justify-center rounded-full", style.icon)}>
          <style.Icon className="size-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">{outcome.title}</p>
          {outcome.detail ? <p className="mt-1 text-[13px] text-muted">{outcome.detail}</p> : null}
        </div>
      </div>
      {outcome.notes?.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[12px] text-muted">
          {outcome.notes.map((n) => <li key={n} className="break-words">{n}</li>)}
        </ul>
      ) : null}
      <div ref={firstAction} className="mt-4 flex flex-wrap gap-2">
        {outcome.actions.map((a) => (
          <Button key={a.label} size="lg" variant={a.variant ?? "default"} onClick={a.onClick}>
            {a.label}
          </Button>
        ))}
      </div>
      {outcome.files?.length ? (
        <div className="mt-4 border-t border-line-subtle pt-3">
          <p className="mb-2 text-[11px] font-medium text-faint">Or download one file</p>
          <ul className="grid gap-1.5">
            {outcome.files.map((f) => (
              <li key={f.label}>
                <button
                  type="button"
                  onClick={f.onClick}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-line-subtle bg-surface px-3 py-2 text-left text-[13px] transition-colors duration-150 hover:border-line-strong hover:bg-hover"
                >
                  <span className="min-w-0 truncate font-medium text-ink">{f.label}</span>
                  <span className="flex shrink-0 items-center gap-2 text-[11px] text-faint">
                    {f.type}
                    <Download className="size-3.5" aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function GenerationStudio({ kind, eyebrow, title, subtitle, stages, meta, preview, outcome, footerNote, tips = FUN_FACTS }: GenerationStudioProps) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const current = stages.find((s) => s.status === "active");
  const doneCount = stages.filter((s) => s.status === "done").length;
  const pill = outcome
    ? { text: outcome.tone === "ok" ? "Ready" : outcome.tone === "warn" ? "Needs a look" : "Needs attention", cls: OUTCOME_STYLE[outcome.tone].ring }
    : { text: "In progress", cls: "border-line bg-surface" };
  const announcement = outcome ? `${outcome.title}. ${outcome.detail ?? ""}` : current ? `${current.label}. ${current.detail ?? ""}` : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-title"
      className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-canvas text-ink"
    >
      <header className="sticky top-0 z-10 border-b border-line-subtle bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1240px] items-center justify-between gap-3 px-4 md:px-8">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <Sparkles className="size-4 text-brand" aria-hidden />
            Layah Studio
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[12px] text-faint sm:inline">{kind}</span>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", pill.cls)}>
              {outcome ? null : <span className="std-dot size-1.5 rounded-full bg-brand" aria-hidden />}
              {pill.text}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 pb-10 pt-6 md:px-8 md:pt-10">
        <div className="std-in">
          {eyebrow ? <p className="font-mono text-[11px] uppercase tracking-wider text-faint">{eyebrow}</p> : null}
          <h1 id="studio-title" ref={headingRef} tabIndex={-1} className="mt-1 text-[22px] font-semibold leading-tight tracking-tight outline-none md:text-[28px]">
            {title}
          </h1>
          {subtitle ? <p className="mt-1.5 max-w-[60ch] text-[14px] text-muted">{subtitle}</p> : null}
          <div className="mt-5">
            <StageProgress stages={stages} />
          </div>
        </div>

        <div
          className={cn(
            "mt-6 grid grid-cols-1 gap-4 [grid-template-areas:'now''preview''steps']",
            "lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-6 lg:[grid-template-areas:'now_preview''steps_preview']",
          )}
        >
          {/* Now: the current stage, or how it ended */}
          <section className="std-in [grid-area:now]" style={{ animationDelay: "60ms" }} aria-label="Current status">
            {outcome ? (
              <OutcomeCard outcome={outcome} />
            ) : (
              <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-pop)]">
                <div className="flex items-center gap-3">
                  <StudioIndicator size={26} />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">{current?.label ?? "Getting started"}</p>
                    <p className="text-[12px] text-faint">{current?.detail ?? "Preparing your request"}</p>
                  </div>
                </div>
              </div>
            )}
            {meta?.length ? (
              <dl className="mt-3 grid grid-cols-2 gap-2">
                {meta.map((m) => (
                  <div key={m.label} className="min-w-0 rounded-lg border border-line-subtle bg-surface px-3 py-2">
                    <dt className="text-[11px] text-faint">{m.label}</dt>
                    <dd className="truncate text-[13px] font-medium">{m.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {!outcome && tips.length ? <WhileYouWait tips={tips} /> : null}
          </section>

          {/* Steps: always open on desktop, collapsible on small screens */}
          <section className="std-in [grid-area:steps]" style={{ animationDelay: "120ms" }} aria-label="Steps">
            <div className="rounded-xl border border-line bg-surface p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left lg:pointer-events-none"
                aria-expanded={stepsOpen}
                onClick={() => setStepsOpen((v) => !v)}
              >
                <span className="text-[12px] font-medium text-faint">
                  Steps · {doneCount} of {stages.length} done
                </span>
                <ChevronDown className={cn("size-4 text-faint transition-transform lg:hidden", stepsOpen && "rotate-180")} aria-hidden />
              </button>
              <div className={cn("mt-3", stepsOpen ? "block" : "hidden", "lg:block")}>
                <StageTimeline stages={stages} />
              </div>
            </div>
          </section>

          <section className="std-scale-in min-w-0 [grid-area:preview]" style={{ animationDelay: "90ms" }} aria-label="Preview">
            {preview}
          </section>
        </div>

        {footerNote && !outcome ? <p className="mt-6 text-center text-[12px] text-faint">{footerNote}</p> : null}
        <p className="sr-only" aria-live="polite" role="status">{announcement}</p>
      </main>
    </div>
  );
}
