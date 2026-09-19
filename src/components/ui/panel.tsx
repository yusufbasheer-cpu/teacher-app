"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Layout, status and state primitives.
 *
 * Two things here are deliberate reversals of what the old codebase did:
 *
 * 1. A panel gets a hairline, not a shadow. Shadows are reserved for things
 *    that genuinely float (menus, dialogs, toasts). Previously every card
 *    carried `shadow-[0px_4px_20px_...]` plus a hover lift, so nothing on a
 *    page had more visual weight than anything else.
 *
 * 2. Every empty/error/loading state is a component, not an afterthought
 *    improvised per screen. `EmptyState` demands an action, because an empty
 *    screen is an invitation to act rather than a place to apologise.
 */

/* -------------------------------------------------------------------------- */
/* Panel                                                                      */
/* -------------------------------------------------------------------------- */

export function Panel({
  className,
  inset = false,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      className={cn(
        "on-surface rounded-xl border border-line-subtle",
        inset ? "bg-sunken" : "bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-4",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-[13px] text-faint">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page header                                                                */
/* -------------------------------------------------------------------------- */

export function PageTitle({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("page-header", className)}>
      <div className="min-w-0">
        <h1 className="page-title">
          {title}
        </h1>
        {description ? (
          <p className="page-description">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */

const BADGE_TONE = {
  neutral: "bg-sunken text-muted border-line-subtle",
  brand: "bg-brand-subtle text-brand-text border-brand-border/50",
  /* "the machine made this" / needs attention */
  generated: "bg-gen-subtle text-gen-text border-gen-border/50",
  danger: "bg-danger-subtle text-danger-text border-danger-border/50",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: keyof typeof BADGE_TONE }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1",
        "text-xs font-medium leading-none",
        BADGE_TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Keyboard shortcut hint. Mono, because it is a machine fact. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-xs border border-line-subtle",
        "bg-sunken px-1 font-mono text-[10px] font-medium text-faint",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                    */
/* -------------------------------------------------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn("size-4 animate-spin-slow text-faint", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton-shimmer rounded-sm", className)} />;
}

/**
 * Skeleton shaped like the content it replaces, so the page does not reflow
 * when data lands. A generic centred spinner was previously used for every
 * load, which told the user nothing about what was coming.
 */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-line-subtle", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* States                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * @param icon    a lucide icon, drawn quietly — the state is about the text
 * @param action  required for genuinely-empty states: an empty screen should
 *                always offer the next step
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: {
  icon?: React.ElementType;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        compact ? "py-10" : "py-16",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 flex size-12 items-center justify-center rounded-md border border-line-subtle bg-sunken text-faint">
          <Icon className="size-4" aria-hidden />
        </span>
      ) : null}
      <p className="text-base font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-faint">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Failure state. Says what happened and offers the way out; never apologises
 * and never leaves the user without a next action.
 */
export function ErrorState({
  title = "That didn't load",
  description,
  onRetry,
  retryLabel = "Try again",
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="mb-4 flex size-12 items-center justify-center rounded-md border border-danger-border/60 bg-danger-subtle text-danger-text">
        <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
          <path
            d="M8 5v3.5M8 11h.01"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </span>
      <p className="text-base font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-faint">{description}</p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** Inline, non-blocking message. For a warning that shouldn't take the page. */
export function Notice({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "generated" | "danger" | "brand";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "border-line-subtle bg-sunken text-muted",
    brand: "border-brand-border/50 bg-brand-subtle text-brand-text",
    generated: "border-gen-border/50 bg-gen-subtle text-gen-text",
    danger: "border-danger-border/60 bg-danger-subtle text-danger-text",
  } as const;
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed",
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Meter                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Quota meter. Escalates tone as headroom runs out, because "3 of 15 used" and
 * "14 of 15 used" are different messages and should not look identical — the
 * old indicator drew the same teal bar either way.
 */
export function Meter({
  used,
  limit,
  label,
  className,
}: {
  used: number;
  limit: number;
  label?: React.ReactNode;
  className?: string;
}) {
  const pct = limit > 0 ? Math.max(0, Math.min(100, (used / limit) * 100)) : 0;
  const left = Math.max(0, limit - used);
  const tone = left === 0 ? "danger" : left <= Math.max(1, limit * 0.2) ? "gen" : "brand";
  const fill = tone === "danger" ? "bg-danger" : tone === "gen" ? "bg-gen" : "bg-brand";

  return (
    <div className={cn("min-w-0", className)}>
      {label ? <div className="mb-1.5 flex items-baseline justify-between gap-2">{label}</div> : null}
      <div
        className="h-1 overflow-hidden rounded-full bg-sunken"
        role="progressbar"
        aria-valuenow={Math.max(0, Math.min(used, limit))}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, limit)}
        aria-label={`${used} of ${limit} generations used`}
      >
        <div
          className={cn("h-full origin-left rounded-full transition-transform duration-300 ease-[var(--ease)]", fill)}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Rule rail — the system's signature                                         */
/* -------------------------------------------------------------------------- */

/**
 * A ruled margin with numbered markers, borrowed from a lesson planner's page.
 *
 * Only for content that is genuinely a *sequence* — the phases of a lesson,
 * the sections of a generated package, the groups of the composer. Order has
 * to carry information the reader needs; otherwise use a plain stack.
 */
export function RuleRail({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rule-rail", className)}>{children}</div>;
}

export function RuleItem({
  num,
  state = "idle",
  className,
  children,
}: {
  num: number | string;
  state?: "idle" | "active" | "done";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rule-item", className)} data-rule-num={num} data-state={state}>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Disclosure                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Optional section, collapsed by default.
 *
 * Progressive disclosure in place of the old three-step wizard: the optional
 * parts of a generation (source material, teaching approach) are one click
 * away on the same screen rather than a separate step everyone has to walk
 * through. `summary` reports what is currently configured, so a collapsed
 * section never hides state the user needs to know about.
 */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  locked = false,
  children,
  className,
}: {
  title: React.ReactNode;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  locked?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const contentId = React.useId();

  return (
    <div className={cn("rounded-lg border border-line-subtle bg-surface", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        disabled={locked}
        className={cn(
          "flex w-full items-center gap-3 px-5 py-4 text-left",
          "transition-colors duration-[140ms]",
          !locked && "hover:bg-hover",
          open ? "rounded-t-lg" : "rounded-lg",
          locked && "cursor-not-allowed",
        )}
      >
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className={cn(
            "size-3 shrink-0 text-faint transition-transform duration-[160ms]",
            open && "rotate-90",
          )}
        >
          <path d="M4 2.5L8 6l-4 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium text-ink">{title}</span>
          {summary && !open ? (
            <span className="mt-0.5 block truncate text-[13px] text-faint">{summary}</span>
          ) : null}
        </span>
      </button>
      {open ? <div id={contentId} className="animate-fade-in border-t border-line-subtle p-5">{children}</div> : null}
    </div>
  );
}
