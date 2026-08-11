import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { PLANS } from "@/lib/plans";

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

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const { data: usageRows } = await admin.from("user_usage").select("*");

  const usageMap = new Map<string, Record<string, unknown>>();
  for (const row of usageRows ?? []) {
    usageMap.set(row.user_id as string, row as Record<string, unknown>);
  }

  const users = (authUsers?.users ?? []).map((u) => {
    const usage = usageMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      planType: (usage?.plan_type as string) ?? "free",
      generationsUsed: Number(usage?.generations_used) || 0,
      generationsLimit: Number(usage?.generations_limit) || PLANS.free.generationsLimit,
    };
  });

  return NextResponse.json({ users });
}
