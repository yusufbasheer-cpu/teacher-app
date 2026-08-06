import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import {
  amountInPaiseFor,
  getRazorpayClient,
  isBillingPeriod,
  isRazorpayPlanType,
} from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as
    | { planType?: string; billingPeriod?: string }
    | null;
  const planType = body?.planType;
  const billingPeriod = body?.billingPeriod;

  if (!planType || !isRazorpayPlanType(planType)) {
    return NextResponse.json({ error: "Invalid or unsupported plan type." }, { status: 400 });
  }
  if (!billingPeriod || !isBillingPeriod(billingPeriod)) {
    return NextResponse.json({ error: "Invalid billing period." }, { status: 400 });
  }
  if (planType === "pro" && billingPeriod === "monthly") {
    return NextResponse.json(
      { error: "Pro Monthly is billed via auto-pay subscription. Use /api/razorpay/create-subscription." },
      { status: 400 },
    );
  }

  const razorpay = getRazorpayClient();
  const admin = getSupabaseServiceRole();
  if (!razorpay || !admin) {
    return NextResponse.json({ error: "Payments are unavailable right now." }, { status: 500 });
  }

  const amount = amountInPaiseFor(planType, billingPeriod);

  let order;
  try {
    order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `usr_${auth.userId.slice(0, 8)}_${Date.now()}`,
      notes: { userId: auth.userId, planType, billingPeriod },
    });
  } catch (err) {
    console.error("[razorpay/create-order] Razorpay API error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  const { error: insertError } = await admin.from("razorpay_orders").insert({
    user_id: auth.userId,
    razorpay_order_id: order.id,
    plan_type: planType,
    billing_period: billingPeriod,
    amount_paise: amount,
    status: "created",
  });

  if (insertError) {
    console.error("[razorpay/create-order] DB error:", insertError.message);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    orderId: order.id,
    amount,
    currency: "INR",
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}
