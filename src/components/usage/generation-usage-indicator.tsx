"use client";

import { formatLimitMessage } from "@/lib/user-usage";
import type { UserUsageSnapshot } from "@/lib/user-usage";

const TEAL = "var(--brand)";

type GenerationUsageIndicatorProps = {
  usage: UserUsageSnapshot | null;
  loading?: boolean;
};

export function GenerationUsageIndicator({ usage, loading }: GenerationUsageIndicatorProps) {
  if (loading) {
    return (
      <div
        className="rounded-2xl border bg-[color-mix(in_oklch,var(--surface)_90%,transparent)] px-4 py-3 text-sm shadow-sm"
        style={{ borderColor: "color-mix(in oklch, var(--brand) 25%, transparent)" }}
      >
        <span style={{ color: "var(--text-secondary)" }}>Loading usage…</span>
      </div>
    );
  }

  if (!usage) return null;

  const label = formatLimitMessage(
    usage.generationsUsed,
    usage.generationsLimit,
    usage.unlimited,
  );

  const percent =
    usage.unlimited || usage.generationsLimit == null
      ? 0
      : Math.min(100, (usage.generationsUsed / usage.generationsLimit) * 100);

  return (
    <div
      className="rounded-2xl border bg-[color-mix(in_oklch,var(--surface)_90%,transparent)] px-4 py-3 shadow-sm"
      style={{ borderColor: "color-mix(in oklch, var(--brand) 25%, transparent)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
          {label}
        </p>
        {!usage.unlimited && usage.generationsLimit != null ? (
          <span className="text-xs font-semibold" style={{ color: TEAL }}>
            {Math.max(0, usage.generationsLimit - usage.generationsUsed)} left
          </span>
        ) : (
          <span className="text-xs font-semibold" style={{ color: TEAL }}>
            Unlimited
          </span>
        )}
      </div>
      {!usage.unlimited && usage.generationsLimit != null ? (
        <div
          className="mt-2 h-2 overflow-hidden rounded-full"
          style={{ background: "color-mix(in oklch, var(--brand) 12%, transparent)" }}
          role="progressbar"
          aria-valuenow={usage.generationsUsed}
          aria-valuemin={0}
          aria-valuemax={usage.generationsLimit}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${percent}%`,
              background: TEAL,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
