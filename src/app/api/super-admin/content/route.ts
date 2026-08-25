import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { CONTENT_TABLE_BY_TYPE, isModeratableContentType } from "@/lib/content-persistence";

export const runtime = "nodejs";

/** Any admin may view content (for QA/support) — content.moderate is only required to flag/delete. */
export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  const search = url.searchParams.get("search")?.trim() ?? "";
  const flaggedOnly = url.searchParams.get("flagged") === "1";

  if (!isModeratableContentType(type)) {
    return NextResponse.json(
      { error: "type must be one of lesson_plan, question_paper, differentiated_pack." },
      { status: 400 },
    );
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const table = CONTENT_TABLE_BY_TYPE[type];
  let query = admin
    .from(table)
    .select("id, user_id, subject, grade, topic, curriculum, flagged, flagged_reason, deleted_at, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (flaggedOnly) query = query.eq("flagged", true);
  if (search) {
    // Strip characters with special meaning in PostgREST's or() filter syntax
    // before interpolating — this is admin-entered, not end-user input, but
    // cheap to keep the filter well-formed regardless.
    const safeSearch = search.replace(/[,()]/g, "");
    if (safeSearch) {
      query = query.or(`subject.ilike.%${safeSearch}%,topic.ilike.%${safeSearch}%,grade.ilike.%${safeSearch}%`);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("[super-admin/content] DB error:", error.message);
    return NextResponse.json({ error: "Could not load content. Please try again." }, { status: 500 });
  }

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const emailByUserId = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  const items = (data ?? []).map((row) => ({
    ...row,
    userEmail: emailByUserId.get(row.user_id as string) ?? "",
  }));

  return NextResponse.json({ items });
}
