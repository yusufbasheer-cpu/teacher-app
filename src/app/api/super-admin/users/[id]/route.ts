import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { hasPermission, isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

/** Full detail view: usage, generation history, plan/payment history (from audit_logs + local Razorpay mirrors), account status. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userId);
  if (authError || !authUser?.user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const [usage, generationEvents, auditHistory, orders, subscriptions] = await Promise.all([
    admin.from("user_usage").select("*").eq("user_id", userId).maybeSingle(),
    admin
      .from("generation_events")
      .select("id, generation_type, status, plan_type, metered, duration_ms, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("audit_logs")
      .select("id, admin_user_id, action, details, created_at")
      .eq("target_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin.from("razorpay_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    user: {
      id: authUser.user.id,
      email: authUser.user.email ?? "",
      createdAt: authUser.user.created_at,
      lastSignInAt: authUser.user.last_sign_in_at ?? null,
    },
    usage: usage.data ?? null,
    generationEvents: generationEvents.data ?? [],
    auditHistory: auditHistory.data ?? [],
    orders: orders.data ?? [],
    subscriptions: subscriptions.data ?? [],
  });
}

/** Permanently deletes the account. Requires user.delete. Irreversible — the UI must confirm before calling this. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (!(await hasPermission(user?.id, "user.delete"))) {
    return NextResponse.json({ error: "You don't have permission to delete users." }, { status: 403 });
  }
  if (userId === user!.id) {
    return NextResponse.json({ error: "You can't delete your own account from here." }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data: targetUser } = await admin.auth.admin.getUserById(userId);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[super-admin/users/delete] auth delete failed:", error.message);
    return NextResponse.json({ error: "Could not delete user. Please try again." }, { status: 500 });
  }

  await logAdminAction(user!.id, "user.delete", userId, { email: targetUser?.user?.email ?? null });

  return NextResponse.json({ ok: true });
}
