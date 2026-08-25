import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { sendEmail } from "@/lib/send-email";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data: targetUser, error: lookupError } = await admin.auth.admin.getUserById(userId);
  if (lookupError || !targetUser?.user?.email) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: targetUser.user.email,
  });
  if (linkError || !linkData) {
    console.error("[super-admin/users/resend-reset] generateLink failed:", linkError?.message);
    return NextResponse.json({ error: "Could not generate a reset link. Please try again." }, { status: 500 });
  }

  const actionLink = linkData.properties.action_link;
  const sendResult = await sendEmail({
    to: targetUser.user.email,
    subject: "Reset your Layah password",
    text: [
      "Hi,",
      "",
      "A Layah admin has requested a password reset for your account.",
      "",
      `Reset your password: ${actionLink}`,
      "",
      "If you didn't expect this, you can safely ignore this email.",
      "",
      "— The Layah Team",
    ].join("\n"),
    html: `<p>Hi,</p><p>A Layah admin has requested a password reset for your account.</p><p><a href="${actionLink}">Reset your password</a></p><p>If you didn't expect this, you can safely ignore this email.</p><p>— The Layah Team</p>`,
  });

  if (!sendResult.ok) {
    return NextResponse.json({ error: "Could not send the reset email. Please try again." }, { status: 500 });
  }

  await logAdminAction(user!.id, "user.resend_reset", userId, { email: targetUser.user.email });

  return NextResponse.json({ ok: true });
}
