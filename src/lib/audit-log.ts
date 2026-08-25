import { getSupabaseServiceRole } from "@/lib/supabase-admin";

export type AuditAction =
  | "school.approve"
  | "school.reject"
  | "school.deactivate"
  | "school.reactivate"
  | "school.assign_admin"
  | "school.remove_admin"
  | "user.change_plan"
  | "user.suspend"
  | "user.unsuspend"
  | "user.delete"
  | "user.impersonate_start"
  | "user.reset_quota"
  | "user.resend_verification"
  | "user.resend_reset"
  | "user.bulk_plan_change"
  | "user.bulk_export"
  | "billing.refund"
  | "billing.trial_grant"
  | "billing.trial_pause"
  | "billing.trial_resume"
  | "billing.offer_apply"
  | "billing.retry_notify_sent"
  | "content.flag"
  | "content.delete"
  | "notification.broadcast_send"
  | "admin.grant_role"
  | "admin.revoke_role"
  | "admin.grant_permission"
  | "admin.revoke_permission"
  | "teacher.remove"
  | "account.delete";

export async function logAdminAction(
  adminUserId: string,
  action: AuditAction,
  targetId: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = getSupabaseServiceRole();
    if (!admin) return;
    const { error } = await admin.from("audit_logs").insert({
      admin_user_id: adminUserId,
      action,
      target_id: targetId,
      details: details ?? null,
    });
    if (error) {
      console.error("[audit-log] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[audit-log] unexpected error:", err instanceof Error ? err.message : err);
  }
}
