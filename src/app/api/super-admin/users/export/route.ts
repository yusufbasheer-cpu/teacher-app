import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { sanitizeExportFileName } from "@/lib/lesson-plan-export";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** CSV export of every user — email, plan, usage, status, signup date. */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
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

  const header = ["email", "plan_type", "generations_used", "generations_limit", "account_status", "created_at"];
  const rows = (authUsers?.users ?? []).map((u) => {
    const usage = usageMap.get(u.id);
    const planType = (usage?.plan_type as string) ?? "free";
    return [
      u.email ?? "",
      planType,
      String(Number(usage?.generations_used) || 0),
      String(Number(usage?.generations_limit) || PLANS.free.generationsLimit || 0),
      (usage?.account_status as string) ?? "active",
      u.created_at,
    ].map(csvEscape).join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");

  await logAdminAction(user!.id, "user.bulk_export", "all-users", { count: rows.length });

  const filename = `${sanitizeExportFileName(`layah-users-${new Date().toISOString().slice(0, 10)}`)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
