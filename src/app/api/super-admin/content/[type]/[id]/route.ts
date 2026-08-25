import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { hasPermission, isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { CONTENT_TABLE_BY_TYPE, isModeratableContentType } from "@/lib/content-persistence";

export const runtime = "nodejs";

/** Soft-deletes a piece of generated content. Requires content.moderate. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (!(await hasPermission(user?.id, "content.moderate"))) {
    return NextResponse.json({ error: "You don't have permission to moderate content." }, { status: 403 });
  }

  if (!isModeratableContentType(type) || !id) {
    return NextResponse.json({ error: "Missing or invalid type/id." }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const table = CONTENT_TABLE_BY_TYPE[type];
  const { error } = await admin
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[super-admin/content/delete] DB error:", error.message);
    return NextResponse.json({ error: "Could not delete content. Please try again." }, { status: 500 });
  }

  await logAdminAction(user!.id, "content.delete", id, { type });

  return NextResponse.json({ ok: true });
}
