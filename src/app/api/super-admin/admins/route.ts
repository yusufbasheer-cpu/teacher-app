import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const runtime = "nodejs";

/** Founder-only: list every admin_roles holder + their granted permissions. */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!await isSuperAdmin(user?.id, user?.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const [{ data: roles, error: rolesError }, { data: permissions, error: permsError }] =
    await Promise.all([
      admin.from("admin_roles").select("user_id, role, created_at").order("created_at", { ascending: true }),
      admin.from("admin_permissions").select("user_id, permission, granted_at"),
    ]);

  if (rolesError || permsError) {
    console.error("[super-admin/admins] DB error:", rolesError?.message ?? permsError?.message);
    return NextResponse.json({ error: "Could not load admins. Please try again." }, { status: 500 });
  }

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const emailByUserId = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  const permissionsByUserId = new Map<string, string[]>();
  for (const row of permissions ?? []) {
    const list = permissionsByUserId.get(row.user_id as string) ?? [];
    list.push(row.permission as string);
    permissionsByUserId.set(row.user_id as string, list);
  }

  const admins = (roles ?? []).map((row) => ({
    userId: row.user_id as string,
    email: emailByUserId.get(row.user_id as string) ?? "",
    role: row.role as "super_admin" | "admin",
    grantedAt: row.created_at as string,
    permissions: permissionsByUserId.get(row.user_id as string) ?? [],
  }));

  return NextResponse.json({ admins });
}
