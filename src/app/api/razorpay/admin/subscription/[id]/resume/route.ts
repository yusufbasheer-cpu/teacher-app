import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { hasPermission, isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { getRazorpayClient } from "@/lib/razorpay";

export const runtime = "nodejs";

/** Resumes a paused subscription immediately (charging resumes on its normal cycle). */
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
    await razorpay.subscriptions.resume(subRow.razorpay_subscription_id, { resume_at: "now" });
  } catch (err) {
    console.error("[razorpay/admin/subscription/resume] Razorpay API error:", err);
    const message = err instanceof Error ? err.message : "Resume failed.";
    return NextResponse.json({ error: `Razorpay rejected the resume: ${message}` }, { status: 502 });
  }

  const { error: updateError } = await admin
    .from("subscriptions")
    .update({
      status: "active",
      paused_at: null,
      intended_resume_at: null,
      pause_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subRow.id);

  if (updateError) {
    console.error("[razorpay/admin/subscription/resume] local update failed after Razorpay succeeded:", updateError.message);
  }

  await logAdminAction(user!.id, "billing.trial_resume", subRow.user_id, {
    subscriptionId: subRow.razorpay_subscription_id,
  });

  return NextResponse.json({ ok: true });
}
