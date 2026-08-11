import type { ReactNode } from "react";
import { NAVY, TEXT_MUTED } from "@/lib/design-tokens";

/** Shared width for form-like pages (the generator wizards, page headers,
 * steppers) — one column so they align to the same left/right edge instead
 * of each independently centering at a different width. `Container` (see
 * `ui/container.tsx`) is the single source of page-width truth (max-w-6xl /
 * 1152px, responsive padding, centered under the sidebar's main area); this
 * class just fills that container's content box rather than adding a
 * second, narrower cap on top of it. */
export const FORM_COLUMN_CLASS = "w-full";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

/** Bare page-level title + description — no border/background/shadow. Sits
 * directly on the app canvas as real page furniture, distinct from content
 * cards, so a page reads as "a page" before any panel/form appears on it. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm" style={{ color: TEXT_MUTED }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
