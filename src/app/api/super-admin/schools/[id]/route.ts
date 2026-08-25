import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const runtime = "nodejs";

/** Linked teachers, seat count, plan tier for one school. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: schoolId } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const [{ data: school, error: schoolError }, { data: teachers, error: teachersError }] = await Promise.all([
    admin.from("school_accounts").select("*").eq("id", schoolId).maybeSingle(),
    admin
      .from("school_teachers")
      .select("id, user_id, email, role, department, joined_at, generations_used_this_month")
      .eq("school_id", schoolId)
      .order("joined_at", { ascending: true }),
  ]);

  if (schoolError || !school) {
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }
  if (teachersError) {
    console.error("[super-admin/schools/id] teachers query failed:", teachersError.message);
  }

  return NextResponse.json({ school, teachers: teachers ?? [] });
}
