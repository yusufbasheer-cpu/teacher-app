import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANS } from "@/lib/plans";
import { firstDayOfNextMonthUtc, todayUtcDateString } from "@/lib/user-usage";
import { sendEmail } from "@/lib/send-email";

export const SUBSCRIPTION_RENEWAL_REMINDER_DAYS = [5, 3, 1, 0] as const;

export type SubscriptionStatus = "created" | "active" | "pending" | "halted" | "cancelled" | "paused";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  razorpay_subscription_id: string;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_cycle_end: boolean;
  updated_at?: string | null;
};

type SubscriptionNoticeRow = {
  subscription_id: string;
  cycle_end: string;
  reminder_day: number;
};

function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseUtcYmd(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function daysUntilUtcDate(ymd: string, from: Date = new Date()): number | null {
  const target = parseUtcYmd(ymd);
  if (!target) return null;
  const deltaMs = target.getTime() - toUtcDate(from).getTime();
  return Math.round(deltaMs / 86400000);
}

export function reminderStageForDaysRemaining(daysRemaining: number | null): number | null {
  if (daysRemaining === null) return null;
  return SUBSCRIPTION_RENEWAL_REMINDER_DAYS.includes(daysRemaining as (typeof SUBSCRIPTION_RENEWAL_REMINDER_DAYS)[number])
    ? daysRemaining
    : null;
}

function reminderCopy(daysRemaining: number, cycleEnd: string) {
  const when =
    daysRemaining === 0
      ? "today"
      : daysRemaining === 1
        ? "in 1 day"
        : `in ${daysRemaining} days`;

  const subject = `Action needed: renew your Layah subscription ${when}`;
  const text = [
    "Hi,",
    "",
    `Your Layah subscription is due to renew on ${cycleEnd}.`,
    `Please recharge or renew your subscription ${when} to keep your paid access active.`,
    "",
    "If the payment does not come through by the end of the 30-day period, your account will be moved back to the Free plan automatically.",
    "",
    "If you need help, reply to this email and we will sort it out.",
    "",
    "— The Layah Team",
  ].join("\n");

  const html = [
    "<p>Hi,</p>",
    `<p>Your Layah subscription is due to renew on <strong>${cycleEnd}</strong>.</p>`,
    `<p>Please recharge or renew your subscription <strong>${when}</strong> to keep your paid access active.</p>`,
    "<p>If the payment does not come through by the end of the 30-day period, your account will be moved back to the Free plan automatically.</p>",
    "<p>If you need help, reply to this email and we will sort it out.</p>",
    "<p>— The Layah Team</p>",
  ].join("");

  return { subject, text, html };
}

async function recordNotice(
  admin: SupabaseClient,
  subscriptionId: string,
  cycleEnd: string,
  reminderDay: number,
): Promise<boolean> {
  const { error } = await admin.from("subscription_billing_notices").insert({
    subscription_id: subscriptionId,
    cycle_end: cycleEnd,
    reminder_day: reminderDay,
  });

  if (error) {
    if (error.code === "23505") return false;
    console.error("[subscription-billing] Failed to record notice:", error.message, {
      subscriptionId,
      cycleEnd,
      reminderDay,
    });
    return false;
  }

  return true;
}

async function noticeAlreadySent(
  admin: SupabaseClient,
  subscriptionId: string,
  cycleEnd: string,
  reminderDay: number,
): Promise<boolean> {
  const { data, error } = await admin
    .from("subscription_billing_notices")
    .select("subscription_id")
    .eq("subscription_id", subscriptionId)
    .eq("cycle_end", cycleEnd)
    .eq("reminder_day", reminderDay)
    .maybeSingle<SubscriptionNoticeRow>();

  if (error) {
    console.error("[subscription-billing] Failed to check notice state:", error.message, {
      subscriptionId,
      cycleEnd,
      reminderDay,
    });
    return false;
  }

  return Boolean(data);
}

export async function sendRenewalReminderIfDue(
  admin: SupabaseClient,
  subscription: SubscriptionRow,
  email: string,
  daysRemaining: number,
): Promise<{ sent: boolean; skippedReason?: string }> {
  if (!subscription.current_period_end) return { sent: false, skippedReason: "missing_cycle_end" };

  const reminderDay = reminderStageForDaysRemaining(daysRemaining);
  if (reminderDay === null) return { sent: false, skippedReason: "not_due" };

  const alreadySent = await noticeAlreadySent(admin, subscription.id, subscription.current_period_end, reminderDay);
  if (alreadySent) {
    return { sent: false, skippedReason: "already_sent" };
  }

  const { subject, text, html } = reminderCopy(daysRemaining, subscription.current_period_end);
  const emailResult = await sendEmail({ to: email, subject, text, html });
  if (!emailResult.ok) {
    return { sent: false, skippedReason: emailResult.error ?? "email_failed" };
  }

  const recorded = await recordNotice(admin, subscription.id, subscription.current_period_end, reminderDay);
  if (!recorded) {
    // If the insert races or fails after a successful email, we still count it
    // as sent; the notice table is only for dedupe, not a source of truth.
  }

  return { sent: true };
}

export async function downgradeSubscriptionToFree(
  admin: SupabaseClient,
  subscription: SubscriptionRow,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error: subError } = await admin
    .from("subscriptions")
    .update({ status: "halted", cancel_at_cycle_end: false, updated_at: now })
    .eq("id", subscription.id);

  if (subError) {
    console.error("[subscription-billing] Failed to mark subscription halted:", subError.message, {
      subscriptionId: subscription.id,
      userId: subscription.user_id,
    });
    return false;
  }

  const { error: usageError } = await admin.from("user_usage").upsert(
    {
      user_id: subscription.user_id,
      plan_type: "free",
      generations_limit: PLANS.free.generationsLimit,
      generations_used: 0,
      reset_date: firstDayOfNextMonthUtc(),
    },
    { onConflict: "user_id" },
  );

  if (usageError) {
    console.error("[subscription-billing] Failed to downgrade user_usage:", usageError.message, {
      subscriptionId: subscription.id,
      userId: subscription.user_id,
    });
    return false;
  }

  return true;
}

export async function reconcileSubscriptionLifecycle(
  admin: SupabaseClient,
  subscription: SubscriptionRow,
  email?: string,
): Promise<{ expired: boolean; reminderSent: boolean; daysRemaining: number | null }> {
  const daysRemaining = subscription.current_period_end
    ? daysUntilUtcDate(subscription.current_period_end)
    : null;

  if (
    subscription.current_period_end &&
    daysRemaining !== null &&
    daysRemaining < 0 &&
    (subscription.status === "active" || subscription.status === "pending")
  ) {
    await downgradeSubscriptionToFree(admin, subscription);
    return { expired: true, reminderSent: false, daysRemaining };
  }

  if (
    email &&
    subscription.current_period_end &&
    daysRemaining !== null &&
    (subscription.status === "active" || subscription.status === "pending")
  ) {
    const reminder = await sendRenewalReminderIfDue(admin, subscription, email, daysRemaining);
    return { expired: false, reminderSent: reminder.sent, daysRemaining };
  }

  return { expired: false, reminderSent: false, daysRemaining };
}

export async function reconcileAllSubscriptions(admin: SupabaseClient): Promise<{
  scanned: number;
  remindersSent: number;
  expired: number;
}> {
  const { data: subs, error } = await admin
    .from("subscriptions")
    .select("id, user_id, razorpay_subscription_id, status, current_period_end, cancel_at_cycle_end, updated_at")
    .in("status", ["active", "pending"])
    .order("current_period_end", { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  let remindersSent = 0;
  let expired = 0;

  for (const sub of subs ?? []) {
    const subscription = sub as SubscriptionRow;

    if (!subscription.current_period_end) continue;

    const daysRemaining = daysUntilUtcDate(subscription.current_period_end);
    if (daysRemaining === null) continue;

    if (daysRemaining < 0) {
      const downgraded = await downgradeSubscriptionToFree(admin, subscription);
      if (downgraded) expired += 1;
      continue;
    }

    if (!SUBSCRIPTION_RENEWAL_REMINDER_DAYS.includes(daysRemaining as (typeof SUBSCRIPTION_RENEWAL_REMINDER_DAYS)[number])) {
      continue;
    }

    const { data: authUser } = await admin.auth.admin.getUserById(subscription.user_id);
    const email = authUser.user?.email;
    if (!email) continue;

    const reminder = await sendRenewalReminderIfDue(admin, subscription, email, daysRemaining);
    if (reminder.sent) remindersSent += 1;
  }

  return { scanned: subs?.length ?? 0, remindersSent, expired };
}

