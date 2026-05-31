import { getSupabaseServiceRole } from "@/lib/supabase-admin";

export type AuditAction =
  | "school.approve"
  | "school.reject"
  | "school.deactivate"
  | "user.change_plan"
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
