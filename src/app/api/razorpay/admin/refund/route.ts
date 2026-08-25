import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { hasPermission, isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { getRazorpayClient } from "@/lib/razorpay";

export const runtime = "nodejs";

type Body = {
  userId?: string;
  paymentId?: string;
  /** Amount in paise. Omit for a full refund. */
  amount?: number;
  reason?: string;
  speed?: "normal" | "optimum";
};

/**
 * Full or partial refund via Razorpay's Refunds API. Requires
 * billing.refund — the named "no refund access" boundary for a narrower
 * admin. Confirmed synchronously from the API response, but the source of
 * truth for FINAL status is the refund.processed/refund.failed webhook
 * (per Razorpay's own recommendation) — see src/app/api/razorpay/webhook/route.ts.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (!(await hasPermission(user?.id, "billing.refund"))) {
    return NextResponse.json({ error: "You don't have permission to issue refunds." }, { status: 403 });
  }

  const { userId, paymentId, amount, reason, speed } = (await req.json()) as Body;
  if (!userId || !paymentId) {
    return NextResponse.json({ error: "Missing userId or paymentId." }, { status: 400 });
  }
  const trimmedReason = reason?.trim() ?? "";
  if (!trimmedReason) {
    return NextResponse.json({ error: "A refund reason is required." }, { status: 400 });
  }
  if (amount != null && (!Number.isInteger(amount) || amount <= 0)) {
    return NextResponse.json({ error: "amount must be a positive integer (paise) or omitted for a full refund." }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  const razorpay = getRazorpayClient();
  if (!admin || !razorpay) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  let refund;
  try {
    refund = await razorpay.payments.refund(paymentId, {
      ...(amount != null ? { amount } : {}),
      speed: speed ?? "normal",
      notes: { reason: trimmedReason, admin_user_id: user!.id },
    });
  } catch (err) {
    console.error("[razorpay/admin/refund] Razorpay API error:", err);
    const message = err instanceof Error ? err.message : "Refund failed.";
    return NextResponse.json({ error: `Razorpay rejected the refund: ${message}` }, { status: 502 });
  }

  const { error: insertError } = await admin.from("razorpay_refunds").insert({
    razorpay_refund_id: refund.id,
    razorpay_payment_id: paymentId,
    user_id: userId,
    amount_paise: refund.amount ?? amount ?? 0,
    is_partial: amount != null,
    reason: trimmedReason,
    status: refund.status,
    initiated_by: user!.id,
  });

  if (insertError) {
    // The refund already happened at Razorpay — log this loudly rather than
    // pretend the request failed (that would risk a confused admin retrying
    // and double-refunding).
    console.error("[razorpay/admin/refund] refund succeeded at Razorpay but local insert failed:", insertError.message, { refundId: refund.id });
  }

  await logAdminAction(user!.id, "billing.refund", userId, {
    paymentId,
    refundId: refund.id,
    amountPaise: refund.amount ?? amount ?? null,
    partial: amount != null,
    reason: trimmedReason,
    status: refund.status,
  });

  return NextResponse.json({ ok: true, refund });
}
