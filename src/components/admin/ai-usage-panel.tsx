"use client";

import { useEffect, useState } from "react";
import { Activity, Coins, Cpu, TriangleAlert } from "lucide-react";
import { AdminButton, AdminCard, EmptyState, FONT_MONO, INK, INK_FAINT, INK_MUTED, SectionHeader } from "@/components/admin/ui/admin-kit";
import { cn } from "@/lib/utils";

type Period = "today" | "7d" | "30d" | "all";
type Usage = {
  staging: boolean;
  allTime: { gammaCredits: number; deepSeekTokens: number; deepSeekCostUsd: number } | null;
  gamma: { runs: number; failures: number; undelivered: number; unsettled: number; creditsUsed: number; latestCreditsRemaining: number | null };
  deepSeek: { calls: number; failures: number; totalTokens: number; estimatedCostUsd: number; unpriced: number; operations: Array<{ operation: string; calls: number; tokens: number; estimatedCostUsd: number; unpriced: number }>; topUsers: Array<{ userId: string; calls: number; tokens: number }> };
  budgets: { daily: number | null; monthly: number | null; selectedPeriodHeadroom: number | null };
  pricing: { sourceDate: string; sourceUrl: string; basis: string; verifiedForRecordedModel: boolean };
  trend: Array<{ date: string; gammaCredits: number; deepSeekTokens: number }>;
};

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const money = (n: number) => `$${n.toFixed(n < 0.01 ? 4 : 2)}`;

export function AiUsagePanel() {
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/super-admin/ai-usage?period=${period}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("AI usage data could not be loaded.");
        setData(await res.json() as Usage);
      })
      .catch((e) => { if (e instanceof Error && e.name !== "AbortError") setError(e.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [period]);

  const maxTrend = Math.max(1, ...(data?.trend.map((d) => Math.max(d.gammaCredits, d.deepSeekTokens)) ?? [1]));
  return (
    <section className="mt-8">
      <SectionHeader
        title="AI usage & credits"
        description="Operational usage from the isolated staging database. DeepSeek currency figures are estimates."
        action={<div className="flex gap-1" aria-label="Usage period">{(["today", "7d", "30d", "all"] as Period[]).map((value) => <AdminButton key={value} size="sm" tone={period === value ? "primary" : "secondary"} onClick={() => setPeriod(value)}>{value === "all" ? "All" : value}</AdminButton>)}</div>}
      />
      {loading ? <EmptyState title="Loading AI usage…" /> : error ? <AdminCard tone="danger"><p className="flex items-center gap-2 text-sm" style={{ color: INK }}><TriangleAlert className="size-4" />{error}</p></AdminCard> : !data ? null : (
        <>
        {data.allTime ? (
          <AdminCard className="mb-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: INK_FAINT }}>All-time totals</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="Gamma credits used" value={compact.format(data.allTime.gammaCredits)} />
              <Metric label="DeepSeek est. cost" value={money(data.allTime.deepSeekCostUsd)} />
              <Metric label="DeepSeek tokens" value={compact.format(data.allTime.deepSeekTokens)} />
            </div>
          </AdminCard>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-2">
          <AdminCard>
            <div className="mb-4 flex items-center gap-2"><Coins className="size-4" /><h3 className="font-semibold" style={{ color: INK }}>Gamma credits</h3></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Credits used" value={compact.format(data.gamma.creditsUsed)} />
              <Metric label="Runs" value={data.gamma.runs} />
              <Metric label="Failures" value={data.gamma.failures} />
              <Metric label="Unsettled" value={data.gamma.unsettled} warning={data.gamma.unsettled > 0} />
              <Metric label="Undelivered" value={data.gamma.undelivered} warning={data.gamma.undelivered > 0} />
              <Metric label="Workspace remaining" value={data.gamma.latestCreditsRemaining ?? "—"} />
            </div>
            <p className="mt-4 text-xs" style={{ color: INK_MUTED }}>Budgets: {data.budgets.daily ?? "—"}/day · {data.budgets.monthly ?? "—"}/month{data.budgets.selectedPeriodHeadroom != null ? ` · ${data.budgets.selectedPeriodHeadroom} headroom` : ""}. Unsettled means Gamma has not reported a cost; it is never counted as zero.</p>
          </AdminCard>

          <AdminCard>
            <div className="mb-4 flex items-center gap-2"><Cpu className="size-4" /><h3 className="font-semibold" style={{ color: INK }}>DeepSeek tokens</h3></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Total tokens" value={compact.format(data.deepSeek.totalTokens)} />
              <Metric label="Calls" value={data.deepSeek.calls} />
              <Metric label="Est. cost" value={money(data.deepSeek.estimatedCostUsd)} />
              <Metric label="Failures" value={data.deepSeek.failures} />
              <Metric label="Unpriced" value={data.deepSeek.unpriced} warning={data.deepSeek.unpriced > 0} />
            </div>
            <p className="mt-4 text-xs" style={{ color: INK_MUTED }}>Estimate uses documented {data.pricing.basis} pricing dated {data.pricing.sourceDate}. Retired or unknown model names remain unpriced.</p>
          </AdminCard>

          <AdminCard>
            <h3 className="mb-3 flex items-center gap-2 font-semibold" style={{ color: INK }}><Activity className="size-4" />Usage trend</h3>
            {data.trend.length === 0 ? <p className="text-sm" style={{ color: INK_MUTED }}>No usage in this period.</p> : <div className="space-y-2">{data.trend.slice(-14).map((point) => <div key={point.date} className="grid grid-cols-[6rem_1fr_auto] items-center gap-2 text-xs"><span className={FONT_MONO} style={{ color: INK_FAINT }}>{point.date.slice(5)}</span><span className="h-2 overflow-hidden rounded-full bg-sunken"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (Math.max(point.gammaCredits, point.deepSeekTokens) / maxTrend) * 100)}%` }} /></span><span className={FONT_MONO} style={{ color: INK_MUTED }}>{compact.format(point.deepSeekTokens)} tok</span></div>)}</div>}
          </AdminCard>

          <AdminCard>
            <h3 className="mb-3 font-semibold" style={{ color: INK }}>Operations & top users</h3>
            {data.deepSeek.operations.length === 0 ? <p className="text-sm" style={{ color: INK_MUTED }}>No DeepSeek calls recorded yet.</p> : <div className="space-y-2">{data.deepSeek.operations.slice(0, 6).map((op) => <div key={op.operation} className="flex items-center justify-between gap-3 text-xs"><span className="truncate" style={{ color: INK_MUTED }}>{op.operation.replaceAll("_", " ")}</span><span className={cn("shrink-0", FONT_MONO)} style={{ color: INK }}>{compact.format(op.tokens)} · {op.calls} calls</span></div>)}</div>}
            {data.deepSeek.topUsers.length > 0 ? <div className="mt-4 border-t pt-3"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: INK_FAINT }}>Top users</p>{data.deepSeek.topUsers.map((user) => <div key={user.userId} className="flex justify-between text-xs"><span className={FONT_MONO} style={{ color: INK_MUTED }}>{user.userId.slice(0, 8)}…</span><span className={FONT_MONO} style={{ color: INK }}>{compact.format(user.tokens)} tokens</span></div>)}</div> : null}
          </AdminCard>
        </div>
        </>
      )}
    </section>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string | number; warning?: boolean }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: INK_FAINT }}>{label}</p><p className={cn("mt-1 text-xl font-semibold", FONT_MONO, warning && "text-warning")} style={warning ? undefined : { color: INK }}>{value}</p></div>;
}
