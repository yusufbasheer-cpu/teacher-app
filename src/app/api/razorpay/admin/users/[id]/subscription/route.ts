import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { getRazorpayClient } from "@/lib/razorpay";

export const runtime = "nodejs";

/**
 * Live reconcile: for every local subscriptions row this user has, fetch
 * the real subscription from Razorpay and return both side by side —
 * Razorpay is the source of truth, the local row is just a mirror the
 * webhook keeps in sync. Any admin may view (read-only).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = getSupabaseServiceRole();
  const razorpay = getRazorpayClient();
  if (!admin || !razorpay) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data: localRows, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[razorpay/admin/users/subscription] DB error:", error.message);
    return NextResponse.json({ error: "Could not load subscriptions." }, { status: 500 });
  }

  const results = await Promise.all(
    (localRows ?? []).map(async (row) => {
      try {
        const live = await razorpay.subscriptions.fetch(row.razorpay_subscription_id);
        const [invoices] = await Promise.all([
          razorpay.invoices.all({ subscription_id: row.razorpay_subscription_id }).catch(() => null),
        ]);
        return {
          local: row,
          live,
          drift: live.status !== row.status,
          invoiceCount: invoices?.count ?? null,
        };
      } catch (err) {
        console.error(
          "[razorpay/admin/users/subscription] fetch failed for",
          row.razorpay_subscription_id,
          err instanceof Error ? err.message : err,
        );
        return { local: row, live: null, drift: null, invoiceCount: null, fetchError: true };
      }
    }),
  );

  return NextResponse.json({ subscriptions: results });
}
