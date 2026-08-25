import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { getRazorpayClient } from "@/lib/razorpay";

export const runtime = "nodejs";

// ~10 years of 30-day cycles. Razorpay requires a total_count (shown to the customer at
// checkout as "charged every 30 days until <date>") -- 10 years reads as a normal long-running
// subscription rather than an alarming multi-century commitment, while still being far longer
// than any realistic subscriber lifetime. If a subscription ever actually reaches this count,
// the webhook's subscription.completed handler downgrades the user the same way cancellation
// does, so nothing is left in a stuck state.
const EFFECTIVELY_INDEFINITE_CYCLES = 120;

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

  // An admin-granted trial (src/app/api/razorpay/admin/trial/grant) — checkout
  // is self-serve, so this is the only point where a trial can actually be
  // applied to a new subscription. Razorpay's start_at only works at
  // creation time, never retroactively.
  const { data: trialGrant } = await admin
    .from("pending_trial_grants")
    .select("id, trial_days")
    .eq("user_id", auth.userId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  const startAt = trialGrant
    ? Math.floor(Date.now() / 1000) + trialGrant.trial_days * 86400
    : undefined;

  let subscription;
  try {
    subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: EFFECTIVELY_INDEFINITE_CYCLES,
      notes: { userId: auth.userId },
      ...(startAt ? { start_at: startAt } : {}),
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
    ...(startAt ? { trial_end_at: new Date(startAt * 1000).toISOString() } : {}),
  });

  if (trialGrant) {
    await admin.from("pending_trial_grants").update({ consumed_at: new Date().toISOString() }).eq("id", trialGrant.id);
  }

  if (insertError) {
    console.error("[razorpay/create-subscription] DB error:", insertError.message);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    subscriptionId: subscription.id,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}
