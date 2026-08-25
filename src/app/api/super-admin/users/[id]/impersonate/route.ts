import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

/**
 * Real session swap: generates a genuine magic-link sign-in for the target
 * user. Returns the link for the admin to open in a SEPARATE browser
 * context (incognito window) — Supabase's client SDK stores sessions in
 * localStorage, shared across tabs of the same browser, so opening this in
 * a normal new tab would overwrite the admin's own session too. Founder-only
 * (isSuperAdmin, not just user.impersonate) given how powerful this is —
 * not delegable to the narrower admin role.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!await isSuperAdmin(user?.id, user?.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
  const trimmedReason = reason?.trim() ?? "";
  if (!trimmedReason) {
    return NextResponse.json({ error: "A reason is required to impersonate a user." }, { status: 400 });
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
    type: "magiclink",
    email: targetUser.user.email,
  });
  if (linkError || !linkData) {
    console.error("[super-admin/users/impersonate] generateLink failed:", linkError?.message);
    return NextResponse.json({ error: "Could not generate an impersonation link. Please try again." }, { status: 500 });
  }

  await admin.from("impersonation_sessions").insert({
    admin_user_id: user!.id,
    target_user_id: userId,
    reason: trimmedReason,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: req.headers.get("user-agent") ?? null,
  });

  await logAdminAction(user!.id, "user.impersonate_start", userId, {
    reason: trimmedReason,
    targetEmail: targetUser.user.email,
  });

  return NextResponse.json({ actionLink: linkData.properties.action_link });
}
