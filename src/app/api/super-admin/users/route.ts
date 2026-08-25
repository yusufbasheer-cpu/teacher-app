import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";

type SortKey = "created_desc" | "created_asc" | "email_asc" | "generations_desc";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!await isSuperAdmin(user?.id, user?.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
  const planFilter = url.searchParams.get("plan")?.trim() ?? "";
  const sort = (url.searchParams.get("sort") as SortKey) || "created_desc";

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const { data: usageRows } = await admin.from("user_usage").select("*");

  const usageMap = new Map<string, Record<string, unknown>>();
  for (const row of usageRows ?? []) {
    usageMap.set(row.user_id as string, row as Record<string, unknown>);
  }

  let users = (authUsers?.users ?? []).map((u) => {
    const usage = usageMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      planType: (usage?.plan_type as string) ?? "free",
      generationsUsed: Number(usage?.generations_used) || 0,
      generationsLimit: Number(usage?.generations_limit) || PLANS.free.generationsLimit,
      accountStatus: (usage?.account_status as string) ?? "active",
    };
  });

  if (search) {
    users = users.filter((u) => u.email.toLowerCase().includes(search));
  }
  if (planFilter) {
    users = users.filter((u) => u.planType === planFilter);
  }

  users.sort((a, b) => {
    switch (sort) {
      case "created_asc":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "email_asc":
        return a.email.localeCompare(b.email);
      case "generations_desc":
        return b.generationsUsed - a.generationsUsed;
      case "created_desc":
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  return NextResponse.json({ users });
}
