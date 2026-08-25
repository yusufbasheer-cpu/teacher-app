import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { hasPermission, isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

/** Removes school-admin status, demoting back to a regular teacher. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id: schoolId, userId } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (!(await hasPermission(user?.id, "school.manage"))) {
    return NextResponse.json({ error: "You don't have permission to manage schools." }, { status: 403 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data: updated, error } = await admin
    .from("school_teachers")
    .update({ role: "teacher" })
    .eq("school_id", schoolId)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    console.error("[super-admin/schools/admins/remove] DB error:", error.message);
    return NextResponse.json({ error: "Could not remove school admin. Please try again." }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "That teacher isn't part of this school." }, { status: 404 });
  }

  await logAdminAction(user!.id, "school.remove_admin", schoolId, { userId });

  return NextResponse.json({ ok: true });
}
