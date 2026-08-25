import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

/**
 * Manually confirms the user's email, rather than "resending" a confirmation
 * email. admin.auth.admin.generateLink({ type: "signup" }) — the naive
 * choice for "resend verification" — requires the user NOT to already
 * exist (it's for admin-created accounts, not re-sending to an existing
 * unconfirmed signup), so it's the wrong tool here. This is the reliable,
 * documented admin action that actually unblocks a "can't log in, email
 * unconfirmed" user.
 */
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

  const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
  if (error) {
    console.error("[super-admin/users/resend-verification] confirm failed:", error.message);
    return NextResponse.json({ error: "Could not confirm the user's email. Please try again." }, { status: 500 });
  }

  await logAdminAction(user!.id, "user.resend_verification", userId, {
    method: "manually confirmed (not a resent email)",
  });

  return NextResponse.json({ ok: true });
}
