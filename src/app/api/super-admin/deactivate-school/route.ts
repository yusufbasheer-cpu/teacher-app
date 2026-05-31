import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!await isSuperAdmin(user?.id, user?.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { schoolId } = (await req.json()) as { schoolId: string };
  if (!schoolId) {
    return NextResponse.json({ error: "Missing schoolId" }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { error } = await admin
    .from("school_accounts")
    .delete()
    .eq("id", schoolId);

  if (error) {
    console.error("[super-admin/deactivate-school] DB error:", error.message);
    return NextResponse.json({ error: "Could not deactivate school. Please try again." }, { status: 500 });
  }

  await logAdminAction(user!.id, "school.deactivate", schoolId);

  return NextResponse.json({ ok: true });
}
