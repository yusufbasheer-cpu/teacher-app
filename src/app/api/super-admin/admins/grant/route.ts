import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin, isAdminPermission } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

type Body = {
  userId?: string;
  role?: "super_admin" | "admin";
  /** For role: "admin" only — the full permission set (replaces any prior grants). Ignored for super_admin, which has every permission implicitly. */
  permissions?: string[];
};

/** Founder-only: grant (or change) an admin role, and for the narrower "admin" role, its permission set. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!await isSuperAdmin(user?.id, user?.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await req.json()) as Body;
  const { userId, role, permissions = [] } = body;

  if (!userId || (role !== "super_admin" && role !== "admin")) {
    return NextResponse.json({ error: "Missing userId or invalid role." }, { status: 400 });
  }

  if (userId === user!.id && role !== "super_admin") {
    return NextResponse.json(
      { error: "You can't downgrade your own role — ask another super admin, or change it directly in the database." },
      { status: 400 },
    );
  }

  const invalidPermission = permissions.find((p) => !isAdminPermission(p));
  if (invalidPermission) {
    return NextResponse.json({ error: `Unknown permission: ${invalidPermission}` }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { error: roleError } = await admin
    .from("admin_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });

  if (roleError) {
    console.error("[super-admin/admins/grant] role upsert failed:", roleError.message);
    return NextResponse.json({ error: "Could not grant role. Please try again." }, { status: 500 });
  }

  // Permission set is only meaningful for the narrower "admin" role — replace it wholesale.
  const { error: deleteError } = await admin.from("admin_permissions").delete().eq("user_id", userId);
  if (deleteError) {
    console.error("[super-admin/admins/grant] permission reset failed:", deleteError.message);
    return NextResponse.json({ error: "Could not update permissions. Please try again." }, { status: 500 });
  }

  if (role === "admin" && permissions.length > 0) {
    const { error: insertError } = await admin.from("admin_permissions").insert(
      permissions.map((permission) => ({ user_id: userId, permission, granted_by: user!.id })),
    );
    if (insertError) {
      console.error("[super-admin/admins/grant] permission insert failed:", insertError.message);
      return NextResponse.json({ error: "Could not grant permissions. Please try again." }, { status: 500 });
    }
  }

  await logAdminAction(user!.id, "admin.grant_role", userId, { role, permissions });

  return NextResponse.json({ ok: true });
}
