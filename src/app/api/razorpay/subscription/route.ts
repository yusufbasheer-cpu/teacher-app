import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { reconcileSubscriptionLifecycle } from "@/lib/subscription-billing";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("subscriptions")
    .select("id, user_id, razorpay_subscription_id, status, current_period_end, cancel_at_cycle_end")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[razorpay/subscription] DB error:", error.message);
    return NextResponse.json({ error: "Could not load subscription." }, { status: 500 });
  }

  if (data) {
    const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
    const email = authUser.user?.email ?? undefined;
    await reconcileSubscriptionLifecycle(admin, data, email);
  }

  return NextResponse.json({ subscription: data ?? null });
}
