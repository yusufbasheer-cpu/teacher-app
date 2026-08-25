import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { hasPermission, isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (!(await hasPermission(user?.id, "user.suspend"))) {
    return NextResponse.json({ error: "You don't have permission to manage user suspensions." }, { status: 403 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { error } = await admin
    .from("user_usage")
    .update({ account_status: "active", suspended_reason: null, suspended_at: null })
    .eq("user_id", userId);

  if (error) {
    console.error("[super-admin/users/unsuspend] DB error:", error.message);
    return NextResponse.json({ error: "Could not unsuspend user. Please try again." }, { status: 500 });
  }

  await logAdminAction(user!.id, "user.unsuspend", userId);

  return NextResponse.json({ ok: true });
}
