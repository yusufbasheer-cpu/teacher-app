import type { ReactNode } from "react";
import { ProBadge } from "@/components/premium/pro-badge";
import { NAVY, TEAL, TEXT_MUTED } from "@/lib/design-tokens";

type LockedFeaturePanelProps = {
  title: string;
  description: string;
  onUpgrade: () => void;
  /** Optional dimmed, non-interactive preview of what the feature contains. */
  children?: ReactNode;
};

/** Shared "visible but disabled" treatment for a Pro-only section that
 * should still communicate what it does — Source Content upload, AFL,
 * Teaching & Learning Strategy. Never hides the feature; always explains it
 * and offers a clear way to unlock it. Reused verbatim everywhere this
 * pattern applies so the platform has one consistent premium-lock look. */
export function LockedFeaturePanel({ title, description, onUpgrade, children }: LockedFeaturePanelProps) {
  return (
    <div
      className="rounded-2xl border border-dashed p-4 sm:p-5"
      style={{ borderColor: "#D9CCB8", background: "rgba(36, 26, 18, 0.02)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold" style={{ color: NAVY }}>
          {title}
        </h3>
        <ProBadge />
      </div>
      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
        {description}
      </p>

      {children ? (
        <div className="mt-4 select-none opacity-60 pointer-events-none" aria-hidden="true">
          {children}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onUpgrade}
        className="mt-4 inline-flex min-h-9 items-center rounded-lg px-4 text-xs font-semibold text-white transition hover:opacity-90"
        style={{ background: TEAL }}
      >
        Upgrade to Pro
      </button>
    </div>
  );
}
