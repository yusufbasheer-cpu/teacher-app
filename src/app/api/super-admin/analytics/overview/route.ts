import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { PRICING_REGIONS } from "@/lib/pricing-regions";

export const runtime = "nodejs";

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * Everything here is derived from data that started flowing once earlier
 * phases landed (generation_events especially) — deliberately last so it
 * has real history instead of launching with empty charts.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const thirtyDaysAgo = isoDaysAgo(30);
  const ninetyDaysAgo = isoDaysAgo(90);

  const [
    { data: authUsers },
    { data: usageRows },
    { data: activeSubs },
    { data: recentEvents },
    { data: recentFailures },
    { data: pendingHaltedSubs },
    { data: failedOrders },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 10000 }),
    admin.from("user_usage").select("user_id, plan_type, generations_used"),
    admin.from("subscriptions").select("id").eq("status", "active"),
    admin.from("generation_events").select("generation_type, status, created_at, user_id").gte("created_at", ninetyDaysAgo),
    admin
      .from("generation_events")
      .select("id, generation_type, error_message, created_at, user_id")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(20),
    admin.from("subscriptions").select("id").in("status", ["pending", "halted"]),
    admin.from("razorpay_orders").select("id").eq("status", "failed"),
  ]);

  const totalUsers = authUsers?.users.length ?? 0;
  const paidPlans = new Set(["pro", "pro_plus", "school_starter", "school_pro", "school_enterprise"]);
  const paidUsers = (usageRows ?? []).filter((r) => paidPlans.has(r.plan_type as string)).length;
  const conversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;

  // MRR: only Pro Monthly supports auto-pay subscriptions today (see
  // create-subscription/route.ts) — annual Pro/Pro Plus are one-time orders,
  // kept separate below rather than blended into a misleading MRR figure.
  const proMonthlyInr = PRICING_REGIONS.india.prices.pro.monthly;
  const mrrInr = (activeSubs?.length ?? 0) * proMonthlyInr;

  // User growth: daily signups over the last 30 days.
  const growthByDay = new Map<string, number>();
  for (const u of authUsers?.users ?? []) {
    if (u.created_at < thirtyDaysAgo) continue;
    const key = dayKey(u.created_at);
    growthByDay.set(key, (growthByDay.get(key) ?? 0) + 1);
  }

  // Generations over time (daily, last 30 days) + feature breakdown (90 days).
  const generationsByDay = new Map<string, number>();
  const byType = { lesson_plan: 0, question_paper: 0, differentiated_pack: 0 };
  let totalGenerations90d = 0;
  let failedGenerations90d = 0;
  const activeUserIds = new Set<string>();
  for (const ev of recentEvents ?? []) {
    totalGenerations90d += 1;
    activeUserIds.add(ev.user_id as string);
    if (ev.status === "failed") failedGenerations90d += 1;
    const type = ev.generation_type as keyof typeof byType;
    if (type in byType) byType[type] += 1;
    if (ev.created_at >= thirtyDaysAgo) {
      const key = dayKey(ev.created_at as string);
      generationsByDay.set(key, (generationsByDay.get(key) ?? 0) + 1);
    }
  }

  const avgGenerationsPerActiveUser = activeUserIds.size > 0 ? totalGenerations90d / activeUserIds.size : 0;
  const inactiveUsers = totalUsers - activeUserIds.size;

  return NextResponse.json({
    mrrInr,
    proMonthlyPriceInr: proMonthlyInr,
    activeSubscriptions: activeSubs?.length ?? 0,
    totalUsers,
    paidUsers,
    conversionRate,
    userGrowthByDay: Object.fromEntries(growthByDay),
    generationsByDay: Object.fromEntries(generationsByDay),
    featureBreakdown90d: byType,
    totalGenerations90d,
    failedGenerations90d,
    avgGenerationsPerActiveUser,
    activeUsers90d: activeUserIds.size,
    inactiveUsers,
    recentErrors: (recentFailures ?? []).map((e) => ({
      id: e.id,
      type: e.generation_type,
      error: e.error_message,
      createdAt: e.created_at,
    })),
    failedPaymentCount: (pendingHaltedSubs?.length ?? 0) + (failedOrders?.length ?? 0),
  });
}
