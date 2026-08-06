import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { isPlanType, getGenerationsLimitForPlan } from "@/lib/user-usage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!await isSuperAdmin(user?.id, user?.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { userId, planType } = (await req.json()) as { userId: string; planType: string };
  if (!userId || !planType) {
    return NextResponse.json({ error: "Missing userId or planType" }, { status: 400 });
  }
  if (!isPlanType(planType)) {
    return NextResponse.json({ error: `Invalid planType: ${planType}` }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const limit = getGenerationsLimitForPlan(planType) ?? -1;

  const { error } = await admin
    .from("user_usage")
    .upsert(
      { user_id: userId, plan_type: planType, generations_limit: limit },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("[super-admin/change-plan] DB error:", error.message);
    return NextResponse.json({ error: "Could not update plan. Please try again." }, { status: 500 });
  }

  await logAdminAction(user!.id, "user.change_plan", userId, { planType, limit });

  return NextResponse.json({ ok: true });
}
