import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { reconcileAllSubscriptions } from "@/lib/subscription-billing";

export const runtime = "nodejs";

/**
 * Daily subscription maintenance:
 * - send reminders when a cycle has 5, 3, 1, or 0 days left
 * - downgrade overdue active/pending subscriptions back to Free
 *
 * This route is intended for Vercel Cron and is only accepted when Vercel's
 * cron schedule header is present.
 */
export async function GET(req: Request) {
  if (!req.headers.get("x-vercel-cron-schedule")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  try {
    const result = await reconcileAllSubscriptions(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/subscription-maintenance] failed:", err);
    return NextResponse.json(
      { error: "Could not run subscription maintenance." },
      { status: 500 },
    );
  }
}

