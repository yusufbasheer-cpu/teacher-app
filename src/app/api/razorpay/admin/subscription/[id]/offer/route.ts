import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { hasPermission, isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { getRazorpayClient } from "@/lib/razorpay";

export const runtime = "nodejs";

type Body = { offerId?: string };

/**
 * Links a Razorpay Offer (discount/cashback) to a subscription. Offers can
 * only be CREATED via the Razorpay Dashboard — there is no API for that,
 * and no "list offers" endpoint either (confirmed: the razorpay npm SDK
 * ships no offers.d.ts at all), so the admin must paste an offer_id they
 * created in the Dashboard. schedule_change_at is fixed to "cycle_end"
 * here — Razorpay does not support applying an offer change immediately.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: subscriptionRowId } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (!(await hasPermission(user?.id, "billing.subscription_manage"))) {
    return NextResponse.json({ error: "You don't have permission to manage subscriptions." }, { status: 403 });
  }

  const { offerId } = (await req.json()) as Body;
  const trimmedOfferId = offerId?.trim() ?? "";
  if (!trimmedOfferId) {
    return NextResponse.json({ error: "Missing offerId." }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  const razorpay = getRazorpayClient();
  if (!admin || !razorpay) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data: subRow, error: fetchError } = await admin
    .from("subscriptions")
    .select("id, user_id, razorpay_subscription_id")
    .eq("id", subscriptionRowId)
    .maybeSingle();

  if (fetchError || !subRow) {
    return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  }

  try {
    await razorpay.subscriptions.update(subRow.razorpay_subscription_id, {
      offer_id: trimmedOfferId,
      schedule_change_at: "cycle_end",
    });
  } catch (err) {
    console.error("[razorpay/admin/subscription/offer] Razorpay API error:", err);
    const message = err instanceof Error ? err.message : "Applying the offer failed.";
    return NextResponse.json({ error: `Razorpay rejected the offer: ${message}` }, { status: 502 });
  }

  const { error: updateError } = await admin
    .from("subscriptions")
    .update({
      active_offer_id: trimmedOfferId,
      offer_scheduled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subRow.id);

  if (updateError) {
    console.error("[razorpay/admin/subscription/offer] local update failed after Razorpay succeeded:", updateError.message);
  }

  await logAdminAction(user!.id, "billing.offer_apply", subRow.user_id, {
    subscriptionId: subRow.razorpay_subscription_id,
    offerId: trimmedOfferId,
  });

  return NextResponse.json({ ok: true, note: "Takes effect at the next billing cycle, not immediately." });
}
