import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { verifySubscriptionSignature } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        razorpay_subscription_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
      }
    | null;
  const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = body ?? {};

  if (!razorpay_subscription_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing subscription payment details." }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Subscriptions are unavailable right now." }, { status: 500 });
  }

  const { data: subscription, error: fetchError } = await admin
    .from("subscriptions")
    .select("id, user_id, status")
    .eq("razorpay_subscription_id", razorpay_subscription_id)
    .maybeSingle();

  if (fetchError || !subscription) {
    return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  }
  if (subscription.user_id !== auth.userId) {
    return NextResponse.json({ error: "Subscription does not belong to this user." }, { status: 403 });
  }
  if (subscription.status === "active") {
    return NextResponse.json({ error: "This subscription has already been activated." }, { status: 409 });
  }

  const validSignature = verifySubscriptionSignature(
    razorpay_subscription_id,
    razorpay_payment_id,
    razorpay_signature,
  );

  if (!validSignature) {
    return NextResponse.json({ error: "Subscription verification failed." }, { status: 400 });
  }

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);
  const periodEndDate = periodEnd.toISOString().slice(0, 10);

  const { error: usageError } = await admin.from("user_usage").upsert(
    {
      user_id: auth.userId,
      plan_type: "pro",
      generations_limit: 30,
      generations_used: 0,
      reset_date: periodEndDate,
    },
    { onConflict: "user_id" },
  );

  if (usageError) {
    console.error("[razorpay/verify-subscription] user_usage update failed:", usageError.message);
    return NextResponse.json(
      { error: "Payment verified but activation failed. Contact support." },
      { status: 500 },
    );
  }

  await admin
    .from("subscriptions")
    .update({ status: "active", current_period_end: periodEndDate, updated_at: new Date().toISOString() })
    .eq("id", subscription.id);

  return NextResponse.json({ ok: true, planType: "pro" });
}
