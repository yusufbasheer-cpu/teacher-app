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

  const [usersRes, usageRes, schoolsRes, pendingRes] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 10000 }),
    admin.from("user_usage").select("user_id, plan_type, generations_used"),
    admin.from("school_accounts").select("id", { count: "exact", head: true }),
    admin.from("school_registration_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const totalUsers = usersRes.data?.users?.length ?? 0;
  const usageRows = usageRes.data ?? [];

  let freeUsers = 0;
  let proUsers = 0;
  let totalGenerationsToday = 0;

  for (const row of usageRows) {
    const plan = String(row.plan_type ?? "free");
    if (plan === "free") freeUsers++;
    else if (plan === "pro" || plan === "pro_plus") proUsers++;
    totalGenerationsToday += Math.max(0, Number(row.generations_used) || 0);
  }

  return NextResponse.json({
    totalUsers,
    freeUsers,
    proUsers,
    totalSchools: schoolsRes.count ?? 0,
    pendingSchools: pendingRes.count ?? 0,
    totalGenerationsToday,
  });
}
