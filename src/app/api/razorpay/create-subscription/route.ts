import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { getRazorpayClient } from "@/lib/razorpay";

export const runtime = "nodejs";

// Roughly 100 years of 30-day cycles -- Razorpay requires a total_count, this is the
// established way to approximate "renews until cancelled" rather than a fixed term.
const EFFECTIVELY_INDEFINITE_CYCLES = 1200;

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as { planType?: string } | null;
  if (body?.planType !== "pro") {
    return NextResponse.json(
      { error: "Only the Pro Monthly plan supports auto-pay subscriptions." },
      { status: 400 },
    );
  }

  const planId = process.env.RAZORPAY_PRO_PLAN_ID?.trim();
  const razorpay = getRazorpayClient();
  const admin = getSupabaseServiceRole();
  if (!planId || !razorpay || !admin) {
    return NextResponse.json({ error: "Subscriptions are unavailable right now." }, { status: 500 });
  }

  let subscription;
  try {
    subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: EFFECTIVELY_INDEFINITE_CYCLES,
      notes: { userId: auth.userId },
    });
  } catch (err) {
    console.error("[razorpay/create-subscription] Razorpay API error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  const { error: insertError } = await admin.from("subscriptions").insert({
    user_id: auth.userId,
    razorpay_subscription_id: subscription.id,
    razorpay_plan_id: planId,
    status: "created",
  });

  if (insertError) {
    console.error("[razorpay/create-subscription] DB error:", insertError.message);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    subscriptionId: subscription.id,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}
