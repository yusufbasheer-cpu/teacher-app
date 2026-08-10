"use client";

import { formatLimitMessage } from "@/lib/user-usage";
import type { UserUsageSnapshot } from "@/lib/user-usage";

const TEAL = "#0E9484";

type GenerationUsageIndicatorProps = {
  usage: UserUsageSnapshot | null;
  loading?: boolean;
};

export function GenerationUsageIndicator({ usage, loading }: GenerationUsageIndicatorProps) {
  if (loading) {
    return (
      <div
        className="rounded-2xl border bg-[#FAF6EF]/90 px-4 py-3 text-sm shadow-sm"
        style={{ borderColor: "rgba(14, 148, 132,0.25)" }}
      >
        <span style={{ color: "#7a6e5f" }}>Loading usage…</span>
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
      className="rounded-2xl border bg-[#FAF6EF]/90 px-4 py-3 shadow-sm"
      style={{ borderColor: "rgba(14, 148, 132,0.25)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium" style={{ color: "#241A12" }}>
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
          style={{ background: "rgba(14, 148, 132,0.12)" }}
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
