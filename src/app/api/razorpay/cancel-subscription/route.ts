import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { getRazorpayClient } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const admin = getSupabaseServiceRole();
  const razorpay = getRazorpayClient();
  if (!admin || !razorpay) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data: subscription, error: fetchError } = await admin
    .from("subscriptions")
    .select("id, razorpay_subscription_id, status, cancel_at_cycle_end")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError || !subscription) {
    return NextResponse.json({ error: "No subscription found." }, { status: 404 });
  }
  if (subscription.status !== "active" && subscription.status !== "pending") {
    return NextResponse.json({ error: "This subscription is not active." }, { status: 409 });
  }
  if (subscription.cancel_at_cycle_end) {
    return NextResponse.json({ error: "This subscription is already set to cancel." }, { status: 409 });
  }

  try {
    // Cancel at cycle end -- the user already paid for the current 30-day period, let them keep
    // Pro access until it naturally ends rather than cutting them off mid-cycle.
    await razorpay.subscriptions.cancel(subscription.razorpay_subscription_id, true);
  } catch (err) {
    console.error("[razorpay/cancel-subscription] Razorpay API error:", err);
    return NextResponse.json({ error: "Could not cancel subscription. Please try again." }, { status: 502 });
  }

  const { error: updateError } = await admin
    .from("subscriptions")
    .update({ cancel_at_cycle_end: true, updated_at: new Date().toISOString() })
    .eq("id", subscription.id);

  if (updateError) {
    console.error("[razorpay/cancel-subscription] DB error:", updateError.message);
    return NextResponse.json({ error: "Cancelled with Razorpay, but failed to record it. Contact support." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
