import { registerActiveSession } from "@/lib/active-session";
import { runSchoolEnrollment } from "@/lib/school-enrollment-client";
import { supabase } from "@/lib/supabase";
import { ensureUserUsageOnClient } from "@/lib/user-usage-client";

export type PostAuthLoginResult =
  | { ok: true }
  | { ok: false; message: string };

/** Session registration, school domain enrollment, then usage row if still missing. */
export async function completePostAuthLogin(userId: string): Promise<PostAuthLoginResult> {
  try {
    await registerActiveSession(userId);
  } catch {
    /* session row optional */
  }

  const enrollment = await runSchoolEnrollment();
  if (!enrollment.ok) {
    await supabase.auth.signOut();
    return { ok: false, message: enrollment.message };
  }

  await ensureUserUsageOnClient(userId);
  return { ok: true };
}
