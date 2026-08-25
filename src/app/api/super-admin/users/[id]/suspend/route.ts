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
    return NextResponse.json({ error: "You don't have permission to suspend users." }, { status: 403 });
  }

  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
  const trimmedReason = reason?.trim() ?? "";
  if (!trimmedReason) {
    return NextResponse.json({ error: "A suspension reason is required." }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data: updated, error } = await admin
    .from("user_usage")
    .update({
      account_status: "suspended",
      suspended_reason: trimmedReason,
      suspended_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("user_id");

  if (error) {
    console.error("[super-admin/users/suspend] DB error:", error.message);
    return NextResponse.json({ error: "Could not suspend user. Please try again." }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "This user has no usage record yet (they've never logged in or generated anything)." },
      { status: 404 },
    );
  }

  await logAdminAction(user!.id, "user.suspend", userId, { reason: trimmedReason });

  return NextResponse.json({ ok: true });
}
