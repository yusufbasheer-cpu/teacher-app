"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminCard, EmptyState, FONT_MONO, INK, INK_FAINT, INK_MUTED, SectionHeader, StatCard, formatAdminDateTime, ACCENT, DANGER, POSITIVE } from "@/components/admin/ui/admin-kit";

type Overview = {
  mrrInr: number;
  proMonthlyPriceInr: number;
  activeSubscriptions: number;
  totalUsers: number;
  paidUsers: number;
  conversionRate: number;
  userGrowthByDay: Record<string, number>;
  generationsByDay: Record<string, number>;
  featureBreakdown90d: { lesson_plan: number; question_paper: number; differentiated_pack: number };
  totalGenerations90d: number;
  failedGenerations90d: number;
  avgGenerationsPerActiveUser: number;
  activeUsers90d: number;
  inactiveUsers: number;
  recentErrors: { id: string; type: string; error: string | null; createdAt: string }[];
  failedPaymentCount: number;
};

/** Hand-rolled SVG bar chart — no charting library in this project yet, and
 * adding one for a handful of admin-only charts wasn't worth the bundle
 * weight. Smooth top edge via rx on each bar keeps it from reading as raw
 * <div> bars. */
function BarChart({ data, color }: { data: Record<string, number>; color: string }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return <p className="text-xs" style={{ color: INK_FAINT }}>No data yet.</p>;
  const max = Math.max(1, ...entries.map(([, v]) => v));
  const width = 100;
  const height = 40;
  const barW = width / entries.length;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" preserveAspectRatio="none">
        {entries.map(([date, value], i) => {
          const h = Math.max(1.5, (value / max) * height);
          return (
            <rect
              key={date}
              x={i * barW + barW * 0.18}
              y={height - h}
              width={barW * 0.64}
              height={h}
              rx={0.8}
              fill={color}
              opacity={0.85}
            >
              <title>{`${date}: ${value}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className={`mt-1 flex justify-between text-[10px] ${FONT_MONO}`} style={{ color: INK_FAINT }}>
        <span>{entries[0][0]}</span>
        <span>{entries[entries.length - 1][0]}</span>
      </div>
    </div>
  );
}

export function AnalyticsPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/analytics/overview");
    if (res.ok) setData((await res.json()) as Overview);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) return <EmptyState title="Loading analytics…" />;
  if (!data) return null;

  return (
    <div className="mt-8 space-y-6">
      <SectionHeader title="Business & Usage Analytics" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR (Pro Monthly)" value={`₹${data.mrrInr.toLocaleString("en-IN")}`} tone="positive" />
        <StatCard label="Free → Paid Conversion" value={`${data.conversionRate.toFixed(1)}%`} />
        <StatCard label="Active Subscriptions" value={data.activeSubscriptions} />
        <StatCard label="Failed / Pending Payments" value={data.failedPaymentCount} tone={data.failedPaymentCount > 0 ? "danger" : "default"} />
        <StatCard label="Active Users (90d)" value={data.activeUsers90d} />
        <StatCard label="Inactive Users" value={data.inactiveUsers} />
        <StatCard label="Avg Generations / Active User" value={data.avgGenerationsPerActiveUser.toFixed(1)} />
        <StatCard label="Failed Generations (90d)" value={data.failedGenerations90d} tone={data.failedGenerations90d > 0 ? "warning" : "default"} />
      </div>

      <p className="text-xs" style={{ color: INK_FAINT }}>
        MRR only counts Pro Monthly auto-pay subscriptions (₹{data.proMonthlyPriceInr}/mo each) — annual Pro/Pro Plus orders are
        one-time payments, not blended in here to avoid a misleading number.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <AdminCard>
          <p className="mb-3 text-sm font-semibold" style={{ color: INK }}>User Growth — last 30 days</p>
          <BarChart data={data.userGrowthByDay} color={ACCENT} />
        </AdminCard>
        <AdminCard>
          <p className="mb-3 text-sm font-semibold" style={{ color: INK }}>Generations — last 30 days</p>
          <BarChart data={data.generationsByDay} color={POSITIVE} />
        </AdminCard>
      </div>

      <AdminCard>
        <p className="mb-3 text-sm font-semibold" style={{ color: INK }}>Feature Usage — last 90 days ({data.totalGenerations90d} total)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(data.featureBreakdown90d).map(([type, count]) => (
            <div key={type} className="rounded-lg px-3 py-2.5" style={{ background: "#FAFAF8" }}>
              <p className="text-xs" style={{ color: INK_MUTED }}>{type.replace(/_/g, " ")}</p>
              <p className={`text-xl font-semibold ${FONT_MONO}`} style={{ color: ACCENT }}>{count}</p>
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard>
        <p className="mb-3 text-sm font-semibold" style={{ color: INK }}>Recent Generation Errors ({data.recentErrors.length})</p>
        {data.recentErrors.length === 0 ? (
          <p className="text-xs" style={{ color: INK_FAINT }}>None recently.</p>
        ) : (
          <div className="max-h-52 space-y-1.5 overflow-y-auto">
            {data.recentErrors.map((e) => (
              <div key={e.id} className="flex flex-wrap gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "#FAFAF8" }}>
                <span className="font-medium" style={{ color: INK }}>{e.type}</span>
                <span style={{ color: DANGER }}>{e.error ?? "—"}</span>
                <span className="ml-auto" style={{ color: INK_FAINT }}>{formatAdminDateTime(e.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
