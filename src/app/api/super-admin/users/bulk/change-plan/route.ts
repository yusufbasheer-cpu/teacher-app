import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { dbLimitValue, isPlanId } from "@/lib/plans";

export const runtime = "nodejs";

type Body = { userIds?: string[]; planType?: string };

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { userIds, planType } = (await req.json()) as Body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "Provide a non-empty userIds array." }, { status: 400 });
  }
  if (!planType || !isPlanId(planType)) {
    return NextResponse.json({ error: `Invalid planType: ${planType}` }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const limit = dbLimitValue(planType);
  const results: { userId: string; ok: boolean }[] = [];

  // One row per user, sequential — this app has no bulk-upsert helper and
  // keeping each user's own audit_logs entry queryable individually matters
  // more here than raw throughput (admin-triggered, not a hot path).
  for (const userId of userIds) {
    const { error } = await admin
      .from("user_usage")
      .upsert({ user_id: userId, plan_type: planType, generations_limit: limit }, { onConflict: "user_id" });
    results.push({ userId, ok: !error });
    if (!error) {
      await logAdminAction(user!.id, "user.bulk_plan_change", userId, { planType, limit });
    } else {
      console.error("[super-admin/users/bulk/change-plan] failed for", userId, error.message);
    }
  }

  const failed = results.filter((r) => !r.ok).map((r) => r.userId);
  return NextResponse.json({ ok: failed.length === 0, updated: results.length - failed.length, failed });
}
