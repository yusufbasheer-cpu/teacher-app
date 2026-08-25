import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { firstDayOfNextMonthUtc } from "@/lib/user-usage";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";

type WebhookPayload = {
  event?: string;
  payload?: {
    subscription?: { entity?: { id?: string } };
    refund?: { entity?: { id?: string; payment_id?: string; status?: string } };
    payment?: { entity?: { id?: string; order_id?: string; status?: string } };
  };
};

async function downgradeToFree(admin: ReturnType<typeof getSupabaseServiceRole>, userId: string) {
  if (!admin) return;
  await admin
    .from("user_usage")
    .update({
      plan_type: "free",
      generations_limit: PLANS.free.generationsLimit,
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
  if (!event) {
    return NextResponse.json({ ok: true });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  // Refund events -- reconcile razorpay_refunds.status. Razorpay's own
  // recommendation is to trust refund.processed/refund.failed as the FINAL
  // status, not just the synchronous API response the admin refund route
  // already recorded optimistically.
  if (event === "refund.processed" || event === "refund.failed") {
    const refundId = payload.payload?.refund?.entity?.id;
    const status = payload.payload?.refund?.entity?.status;
    if (refundId && status) {
      await admin
        .from("razorpay_refunds")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("razorpay_refund_id", refundId);
    }
    return NextResponse.json({ ok: true });
  }

  // One-time order payment failure -- orders previously had no webhook
  // fallback at all (only the client-driven verify-payment call), so a
  // payment that failed/timed out before the browser could report back
  // left the local razorpay_orders row stuck at "created" forever. This
  // closes that gap. Subscription renewal failures are handled separately
  // via subscription.pending/halted below, not this event.
  if (event === "payment.failed") {
    const orderId = payload.payload?.payment?.entity?.order_id;
    if (orderId) {
      await admin
        .from("razorpay_orders")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("razorpay_order_id", orderId)
        .eq("status", "created"); // never overwrite an order that already verified as paid
    }
    return NextResponse.json({ ok: true });
  }

  const razorpaySubscriptionId = payload.payload?.subscription?.entity?.id;
  if (!razorpaySubscriptionId) {
    // Not a subscription event we care about -- ack and ignore.
    return NextResponse.json({ ok: true });
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

    case "subscription.paused": {
      // Safety net for the admin pause route already updating this
      // synchronously -- also catches a pause made directly in the
      // Razorpay Dashboard, bypassing our own route entirely.
      await admin
        .from("subscriptions")
        .update({ status: "paused", paused_at: now, updated_at: now })
        .eq("id", subscription.id);
      break;
    }

    case "subscription.resumed": {
      await admin
        .from("subscriptions")
        .update({ status: "active", paused_at: null, intended_resume_at: null, pause_reason: null, updated_at: now })
        .eq("id", subscription.id);
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
