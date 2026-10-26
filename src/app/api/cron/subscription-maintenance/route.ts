import { NextResponse } from "next/server";
import { hasValidInternalBearer } from "@/lib/api-authorization";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { reconcileAllSubscriptions } from "@/lib/subscription-billing";

export const runtime = "nodejs";

/**
 * Daily subscription maintenance:
 * - send reminders when a cycle has 5, 3, 1, or 0 days left
 * - downgrade overdue active/pending subscriptions back to Free
 *
 * Vercel sends CRON_SECRET as a bearer token. The schedule header is not an
 * authenticator because any direct caller can add it themselves.
 */
export async function GET(req: Request) {
  if (!hasValidInternalBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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

