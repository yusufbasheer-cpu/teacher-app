import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { hasPermission, isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { CONTENT_TABLE_BY_TYPE, isModeratableContentType } from "@/lib/content-persistence";

export const runtime = "nodejs";

type Body = { type?: string; id?: string; reason?: string; flagged?: boolean };

/** Flag (or unflag) a piece of generated content. Requires content.moderate. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (!(await hasPermission(user?.id, "content.moderate"))) {
    return NextResponse.json({ error: "You don't have permission to moderate content." }, { status: 403 });
  }

  const { type, id, reason, flagged = true } = (await req.json()) as Body;
  if (!type || !isModeratableContentType(type) || !id) {
    return NextResponse.json({ error: "Missing or invalid type/id." }, { status: 400 });
  }
  const trimmedReason = reason?.trim() ?? "";
  if (flagged && !trimmedReason) {
    return NextResponse.json({ error: "A reason is required to flag content." }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const table = CONTENT_TABLE_BY_TYPE[type];
  const { error } = await admin
    .from(table)
    .update(
      flagged
        ? { flagged: true, flagged_reason: trimmedReason, flagged_by: user!.id }
        : { flagged: false, flagged_reason: null, flagged_by: null },
    )
    .eq("id", id);

  if (error) {
    console.error("[super-admin/content/flag] DB error:", error.message);
    return NextResponse.json({ error: "Could not update content. Please try again." }, { status: 500 });
  }

  await logAdminAction(user!.id, "content.flag", id, { type, flagged, reason: trimmedReason || undefined });

  return NextResponse.json({ ok: true });
}
