import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { hasPermission, isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

type Body = { userId?: string; trialDays?: number };

/**
 * Grants a trial for a user's NEXT self-serve checkout — only applicable
 * before they subscribe. Razorpay's start_at trial mechanism can't be
 * added to an already-active subscription; for an existing subscriber,
 * use the pause/resume routes instead to give free time.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (!(await hasPermission(user?.id, "billing.subscription_manage"))) {
    return NextResponse.json({ error: "You don't have permission to manage subscriptions." }, { status: 403 });
  }

  const { userId, trialDays } = (await req.json()) as Body;
  if (!userId || !trialDays || trialDays <= 0) {
    return NextResponse.json({ error: "Missing userId or a positive trialDays." }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data: activeSub } = await admin
    .from("subscriptions")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["active", "pending", "created"])
    .maybeSingle();

  if (activeSub) {
    return NextResponse.json(
      {
        error:
          "This user already has an active/pending subscription — a trial can't be added retroactively. Use pause instead to give them free time.",
      },
      { status: 409 },
    );
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // the grant itself expires if unused, so it can't surprise-trigger months later

  // pending_trial_grants only enforces "at most one unconsumed grant per
  // user" via a partial unique index (where consumed_at is null) — a plain
  // upsert's ON CONFLICT can't target a partial index without also
  // repeating its WHERE clause, so this checks-then-writes explicitly
  // instead of relying on ON CONFLICT.
  const { data: existingGrant } = await admin
    .from("pending_trial_grants")
    .select("id")
    .eq("user_id", userId)
    .is("consumed_at", null)
    .maybeSingle();

  const { error } = existingGrant
    ? await admin
        .from("pending_trial_grants")
        .update({
          trial_days: trialDays,
          granted_by: user!.id,
          granted_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", existingGrant.id)
    : await admin.from("pending_trial_grants").insert({
        user_id: userId,
        trial_days: trialDays,
        granted_by: user!.id,
        expires_at: expiresAt.toISOString(),
      });

  if (error) {
    console.error("[razorpay/admin/trial/grant] DB error:", error.message);
    return NextResponse.json({ error: "Could not grant trial. Please try again." }, { status: 500 });
  }

  await logAdminAction(user!.id, "billing.trial_grant", userId, { trialDays });

  return NextResponse.json({ ok: true });
}
