import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { verifyPaymentSignature, isRazorpayPlanType } from "@/lib/razorpay";
import { getGenerationsLimitForPlan } from "@/lib/user-usage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
      }
    | null;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Payments are unavailable right now." }, { status: 500 });
  }

  const { data: order, error: fetchError } = await admin
    .from("razorpay_orders")
    .select("id, user_id, plan_type, status")
    .eq("razorpay_order_id", razorpay_order_id)
    .maybeSingle();

  if (fetchError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.user_id !== auth.userId) {
    return NextResponse.json({ error: "Order does not belong to this user." }, { status: 403 });
  }
  if (order.status === "paid") {
    return NextResponse.json({ error: "This order has already been processed." }, { status: 409 });
  }

  const validSignature = verifyPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );

  if (!validSignature) {
    await admin
      .from("razorpay_orders")
      .update({ status: "failed", razorpay_payment_id, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  }

  const planType = order.plan_type;
  if (!isRazorpayPlanType(planType)) {
    console.error("[razorpay/verify-payment] Unexpected plan_type on order:", planType);
    return NextResponse.json({ error: "Could not apply upgrade. Contact support." }, { status: 500 });
  }

  const { error: usageError } = await admin.from("user_usage").upsert(
    {
      user_id: auth.userId,
      plan_type: planType,
      generations_limit: getGenerationsLimitForPlan(planType),
      generations_used: 0,
    },
    { onConflict: "user_id" },
  );

  if (usageError) {
    console.error("[razorpay/verify-payment] user_usage update failed:", usageError.message);
    return NextResponse.json({ error: "Payment verified but upgrade failed. Contact support." }, { status: 500 });
  }

  await admin
    .from("razorpay_orders")
    .update({ status: "paid", razorpay_payment_id, updated_at: new Date().toISOString() })
    .eq("id", order.id);

  return NextResponse.json({ ok: true, planType });
}
