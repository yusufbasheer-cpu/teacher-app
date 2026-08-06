import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { firstDayOfNextMonthUtc } from "@/lib/user-usage";

export const runtime = "nodejs";

type WebhookPayload = {
  event?: string;
  payload?: {
    subscription?: { entity?: { id?: string } };
  };
};

async function downgradeToFree(admin: ReturnType<typeof getSupabaseServiceRole>, userId: string) {
  if (!admin) return;
  await admin
    .from("user_usage")
    .update({
      plan_type: "free",
      generations_limit: 15,
      generations_used: 0,
      reset_date: firstDayOfNextMonthUtc(),
    })
    .eq("user_id", userId);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[razorpay/webhook] signature verification failed");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const event = payload.event;
  const razorpaySubscriptionId = payload.payload?.subscription?.entity?.id;

  if (!event || !razorpaySubscriptionId) {
    // Not a subscription event we care about (e.g. a payment/order webhook) -- ack and ignore.
    return NextResponse.json({ ok: true });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data: subscription, error: fetchError } = await admin
    .from("subscriptions")
    .select("id, user_id")
    .eq("razorpay_subscription_id", razorpaySubscriptionId)
    .maybeSingle();

  if (fetchError || !subscription) {
    console.warn("[razorpay/webhook] unknown subscription id:", razorpaySubscriptionId);
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();

  switch (event) {
    case "subscription.activated":
    case "subscription.charged": {
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);
      const periodEndDate = periodEnd.toISOString().slice(0, 10);

      await admin
        .from("subscriptions")
        .update({ status: "active", current_period_end: periodEndDate, updated_at: now })
        .eq("id", subscription.id);

      await admin.from("user_usage").upsert(
        {
          user_id: subscription.user_id,
          plan_type: "pro",
          generations_limit: 30,
          generations_used: 0,
          reset_date: periodEndDate,
        },
        { onConflict: "user_id" },
      );
      break;
    }

    case "subscription.pending": {
      // Razorpay is auto-retrying a failed renewal charge -- this is the grace period. Don't
      // touch user_usage; the user keeps Pro access while retries are in progress.
      await admin
        .from("subscriptions")
        .update({ status: "pending", updated_at: now })
        .eq("id", subscription.id);
      break;
    }

    case "subscription.halted": {
      // Retries exhausted -- grace period is over.
      await admin
        .from("subscriptions")
        .update({ status: "halted", updated_at: now })
        .eq("id", subscription.id);
      await downgradeToFree(admin, subscription.user_id);
      break;
    }

    case "subscription.cancelled":
    case "subscription.completed": {
      // completed = the subscription's total_count of billing cycles was reached (see
      // create-subscription's EFFECTIVELY_INDEFINITE_CYCLES comment) -- treat the same as
      // cancelled rather than leaving the user stuck on a plan nothing will renew anymore.
      await admin
        .from("subscriptions")
        .update({ status: "cancelled", updated_at: now })
        .eq("id", subscription.id);
      await downgradeToFree(admin, subscription.user_id);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
