import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

type Body = { userId?: string };

/** Founder-only: fully revoke a user's admin access (role + all permissions). */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!await isSuperAdmin(user?.id, user?.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { userId } = (await req.json()) as Body;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  if (userId === user!.id) {
    return NextResponse.json(
      { error: "You can't revoke your own access — ask another super admin, or change it directly in the database." },
      { status: 400 },
    );
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const [{ error: permError }, { error: roleError }] = await Promise.all([
    admin.from("admin_permissions").delete().eq("user_id", userId),
    admin.from("admin_roles").delete().eq("user_id", userId),
  ]);

  if (permError || roleError) {
    console.error("[super-admin/admins/revoke] delete failed:", permError?.message ?? roleError?.message);
    return NextResponse.json({ error: "Could not revoke access. Please try again." }, { status: 500 });
  }

  await logAdminAction(user!.id, "admin.revoke_role", userId);

  return NextResponse.json({ ok: true });
}
