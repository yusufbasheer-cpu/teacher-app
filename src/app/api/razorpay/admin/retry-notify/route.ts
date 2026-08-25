import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { hasPermission, isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { sendEmail } from "@/lib/send-email";

export const runtime = "nodejs";

type Body = { userId?: string };

/**
 * Sends the customer a payment-reminder email. Razorpay has no API to
 * force-retry a charge on demand — failed subscription charges are already
 * auto-retried by Razorpay's own schedule during the "pending" state, and
 * there's no documented "retry now" endpoint. This is a notification, not
 * a retry — named and worded accordingly rather than implying otherwise.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (!(await hasPermission(user?.id, "billing.retry_notify"))) {
    return NextResponse.json({ error: "You don't have permission to send billing reminders." }, { status: 403 });
  }

  const { userId } = (await req.json()) as Body;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data: targetUser, error: lookupError } = await admin.auth.admin.getUserById(userId);
  if (lookupError || !targetUser?.user?.email) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const sendResult = await sendEmail({
    to: targetUser.user.email,
    subject: "Action needed: your Layah payment didn't go through",
    text: [
      "Hi,",
      "",
      "Your last Layah subscription payment didn't go through. To keep your Pro access active, please update your payment method or retry the charge from your account.",
      "",
      "If you have any questions, just reply to this email.",
      "",
      "— The Layah Team",
    ].join("\n"),
    html: `<p>Hi,</p><p>Your last Layah subscription payment didn't go through. To keep your Pro access active, please update your payment method or retry the charge from your account.</p><p>If you have any questions, just reply to this email.</p><p>— The Layah Team</p>`,
  });

  if (!sendResult.ok) {
    return NextResponse.json({ error: "Could not send the reminder email." }, { status: 500 });
  }

  await logAdminAction(user!.id, "billing.retry_notify_sent", userId, { email: targetUser.user.email });

  return NextResponse.json({ ok: true });
}
