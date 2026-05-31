import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const runtime = "nodejs";

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

  const { data, error } = await admin
    .from("school_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[super-admin/schools] DB error:", error.message);
    return NextResponse.json({ error: "Could not load schools. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ schools: data ?? [] });
}
