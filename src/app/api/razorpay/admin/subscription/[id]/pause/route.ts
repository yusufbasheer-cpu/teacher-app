import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { hasPermission, isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { getRazorpayClient } from "@/lib/razorpay";

export const runtime = "nodejs";

type Body = { intendedResumeAt?: string; reason?: string };

/**
 * Pauses an active subscription immediately (no charges while paused) —
 * the real mechanism for extending an existing subscriber's grace period,
 * since Razorpay's trial start_at can't be applied retroactively.
 * intendedResumeAt is the admin's stated intent only; Razorpay's pause API
 * has no scheduled/future option (confirmed via the SDK's own types —
 * pause_at only accepts "now"), so resuming is always a separate manual
 * action (or a future cron, if this proves operationally common).
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

  const { intendedResumeAt, reason } = (await req.json()) as Body;
  const trimmedReason = reason?.trim() ?? "";
  if (!trimmedReason) {
    return NextResponse.json({ error: "A reason is required to pause a subscription." }, { status: 400 });
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
    await razorpay.subscriptions.pause(subRow.razorpay_subscription_id, { pause_at: "now" });
  } catch (err) {
    console.error("[razorpay/admin/subscription/pause] Razorpay API error:", err);
    const message = err instanceof Error ? err.message : "Pause failed.";
    return NextResponse.json({ error: `Razorpay rejected the pause: ${message}` }, { status: 502 });
  }

  const { error: updateError } = await admin
    .from("subscriptions")
    .update({
      status: "paused",
      paused_at: new Date().toISOString(),
      intended_resume_at: intendedResumeAt || null,
      pause_reason: trimmedReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subRow.id);

  if (updateError) {
    console.error("[razorpay/admin/subscription/pause] local update failed after Razorpay succeeded:", updateError.message);
  }

  await logAdminAction(user!.id, "billing.trial_pause", subRow.user_id, {
    subscriptionId: subRow.razorpay_subscription_id,
    intendedResumeAt: intendedResumeAt || null,
    reason: trimmedReason,
  });

  return NextResponse.json({ ok: true });
}
