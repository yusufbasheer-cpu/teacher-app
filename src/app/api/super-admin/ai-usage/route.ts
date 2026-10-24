import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/super-admin";
import { aggregateAiUsage, type DeepSeekUsageRow, type GammaUsageRow } from "@/lib/ai-usage/aggregate";
import { DEEPSEEK_PRICING } from "@/lib/ai-usage/deepseek";

export const runtime = "nodejs";
const PERIOD_DAYS = { today: 0, "7d": 7, "30d": 30, all: null } as const;

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!await isSuperAdmin(user?.id, user?.email)) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const period = new URL(req.url).searchParams.get("period") as keyof typeof PERIOD_DAYS | null;
  const selected = period && period in PERIOD_DAYS ? period : "7d";
  const admin = getSupabaseServiceRole();
  if (!admin) return NextResponse.json({ error: "Service unavailable." }, { status: 500 });

  let gammaQuery = admin.from("gamma_generations").select("user_id,status,credits_deducted,credits_remaining,delivered,error_code,created_at").order("created_at", { ascending: false });
  let deepQuery = admin.from("ai_usage_events").select("user_id,operation,status,prompt_tokens,completion_tokens,cache_hit_tokens,cache_miss_tokens,total_tokens,estimated_cost_usd,created_at").order("created_at", { ascending: false });
  const days = PERIOD_DAYS[selected];
  if (days !== null) {
    const start = new Date();
    if (days === 0) start.setUTCHours(0, 0, 0, 0);
    else start.setUTCDate(start.getUTCDate() - days);
    gammaQuery = gammaQuery.gte("created_at", start.toISOString());
    deepQuery = deepQuery.gte("created_at", start.toISOString());
  }
  // All-time totals for both providers, shown whatever period is selected. Different units (Gamma credits vs
  // estimated DeepSeek dollars), so they're reported side by side rather than added together.
  const [gammaResult, deepResult, gammaAll, deepAll] = await Promise.all([
    gammaQuery,
    deepQuery,
    admin.from("gamma_generations").select("credits_deducted"),
    admin.from("ai_usage_events").select("total_tokens,estimated_cost_usd"),
  ]);
  if (gammaResult.error || deepResult.error) return NextResponse.json({ error: "Usage data unavailable." }, { status: 500 });

  const summary = aggregateAiUsage((gammaResult.data ?? []) as GammaUsageRow[], (deepResult.data ?? []) as DeepSeekUsageRow[]);
  const allTime = gammaAll.error || deepAll.error ? null : {
    gammaCredits: (gammaAll.data ?? []).reduce((t, r) => t + (Number(r.credits_deducted) || 0), 0),
    deepSeekTokens: (deepAll.data ?? []).reduce((t, r) => t + (Number(r.total_tokens) || 0), 0),
    deepSeekCostUsd: (deepAll.data ?? []).reduce((t, r) => t + (Number(r.estimated_cost_usd) || 0), 0),
  };
  const dailyBudget = Number(process.env.GAMMA_DAILY_CREDIT_BUDGET) || null;
  const monthlyBudget = Number(process.env.GAMMA_MONTHLY_CREDIT_BUDGET) || null;
  return NextResponse.json({
    period: selected,
    staging: true,
    allTime,
    ...summary,
    budgets: {
      daily: dailyBudget,
      monthly: monthlyBudget,
      selectedPeriodHeadroom: selected === "today" && dailyBudget !== null ? Math.max(0, dailyBudget - summary.gamma.creditsUsed) : selected === "30d" && monthlyBudget !== null ? Math.max(0, monthlyBudget - summary.gamma.creditsUsed) : null,
    },
    pricing: { ...DEEPSEEK_PRICING, models: undefined, verifiedForRecordedModel: summary.deepSeek.unpriced === 0 },
  }, { headers: { "cache-control": "no-store" } });
}
