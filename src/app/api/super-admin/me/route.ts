import { NextResponse } from "next/server";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json({ isSuperAdmin: isSuperAdminEmail(user?.email) });
}
