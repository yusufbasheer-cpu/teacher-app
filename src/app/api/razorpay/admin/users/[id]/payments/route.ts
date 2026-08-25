import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { getRazorpayClient } from "@/lib/razorpay";

export const runtime = "nodejs";

/**
 * Live payment history for this user, combining one-time order payments
 * (via orders.fetchPayments) and subscription invoices (which carry their
 * own payment_id/amount_paid/status — no extra per-payment fetch needed).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = getSupabaseServiceRole();
  const razorpay = getRazorpayClient();
  if (!admin || !razorpay) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const [{ data: orders }, { data: subs }] = await Promise.all([
    admin.from("razorpay_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("subscriptions").select("*").eq("user_id", userId),
  ]);

  const orderPayments = (
    await Promise.all(
      (orders ?? []).map(async (order) => {
        try {
          const result = await razorpay.orders.fetchPayments(order.razorpay_order_id);
          return result.items.map((p) => ({
            source: "order" as const,
            id: p.id,
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            method: p.method,
            createdAt: p.created_at,
            orderId: order.razorpay_order_id,
          }));
        } catch (err) {
          console.error("[razorpay/admin/users/payments] order fetch failed:", order.razorpay_order_id, err instanceof Error ? err.message : err);
          return [];
        }
      }),
    )
  ).flat();

  const invoicePayments = (
    await Promise.all(
      (subs ?? []).map(async (sub) => {
        try {
          const result = await razorpay.invoices.all({ subscription_id: sub.razorpay_subscription_id });
          return result.items
            .filter((inv) => inv.payment_id)
            .map((inv) => ({
              source: "subscription" as const,
              id: inv.payment_id as string,
              amount: inv.amount_paid ?? 0,
              currency: inv.currency ?? "INR",
              status: inv.status ?? "unknown",
              method: null,
              createdAt: inv.paid_at ?? inv.date ?? 0,
              subscriptionId: sub.razorpay_subscription_id,
            }));
        } catch (err) {
          console.error("[razorpay/admin/users/payments] invoice fetch failed:", sub.razorpay_subscription_id, err instanceof Error ? err.message : err);
          return [];
        }
      }),
    )
  ).flat();

  const payments = [...orderPayments, ...invoicePayments].sort((a, b) => b.createdAt - a.createdAt);

  return NextResponse.json({ payments });
}
