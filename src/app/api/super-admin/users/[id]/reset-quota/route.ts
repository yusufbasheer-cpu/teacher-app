import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

/** Any admin — low-risk, no special permission required. */
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

  const { data: before } = await admin
    .from("user_usage")
    .select("generations_used")
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await admin
    .from("user_usage")
    .update({ generations_used: 0 })
    .eq("user_id", userId);

  if (error) {
    console.error("[super-admin/users/reset-quota] DB error:", error.message);
    return NextResponse.json({ error: "Could not reset quota. Please try again." }, { status: 500 });
  }

  await logAdminAction(user!.id, "user.reset_quota", userId, {
    before: before?.generations_used ?? null,
    after: 0,
  });

  return NextResponse.json({ ok: true });
}
