import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const runtime = "nodejs";

/**
 * Failed/pending payment signals — keyed off the real events this app's
 * webhook actually receives (subscription.pending, subscription.halted,
 * payment.failed via razorpay_orders.status). There is no
 * "subscription.charge.failed" event in Razorpay's API (confirmed against
 * their docs) — subscriptions.pending fires on a failed charge attempt
 * (Razorpay auto-retries), escalating to halted once retries are exhausted.
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

  const [{ data: pendingSubs, error: subsError }, { data: failedOrders, error: ordersError }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("*")
      .in("status", ["pending", "halted"])
      .order("updated_at", { ascending: false }),
    admin
      .from("razorpay_orders")
      .select("*")
      .eq("status", "failed")
      .order("updated_at", { ascending: false }),
  ]);

  if (subsError || ordersError) {
    console.error("[razorpay/admin/failed-payments] DB error:", subsError?.message ?? ordersError?.message);
    return NextResponse.json({ error: "Could not load failed payments." }, { status: 500 });
  }

  const userIds = [...new Set([...(pendingSubs ?? []).map((s) => s.user_id), ...(failedOrders ?? []).map((o) => o.user_id)])];
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const emailByUserId = new Map((authUsers?.users ?? []).filter((u) => userIds.includes(u.id)).map((u) => [u.id, u.email ?? ""]));

  return NextResponse.json({
    pendingOrHaltedSubscriptions: (pendingSubs ?? []).map((s) => ({ ...s, userEmail: emailByUserId.get(s.user_id) ?? "" })),
    failedOrders: (failedOrders ?? []).map((o) => ({ ...o, userEmail: emailByUserId.get(o.user_id) ?? "" })),
  });
}
