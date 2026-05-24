import { registerActiveSession } from "@/lib/active-session";
import { runSchoolEnrollment } from "@/lib/school-enrollment-client";
import { supabase } from "@/lib/supabase";
import { ensureUserUsageOnClient } from "@/lib/user-usage-client";

export type PostAuthLoginResult =
  | { ok: true }
  | { ok: false; message: string };

async function registerSession(userId: string): Promise<void> {
  try {
    await registerActiveSession(userId);
  } catch {
    /* session row optional */
  }
}

/** Google OAuth: school domain enrollment, then usage row if missing. */
export async function completeGooglePostAuthLogin(userId: string): Promise<PostAuthLoginResult> {
  await registerSession(userId);

  const enrollment = await runSchoolEnrollment();
  if (!enrollment.ok) {
    await supabase.auth.signOut();
    return { ok: false, message: enrollment.message };
  }

  await ensureUserUsageOnClient(userId);
  return { ok: true };
}

/** Email/password: no school enrollment — individual accounts only. */
export async function completeEmailPostAuthLogin(userId: string): Promise<PostAuthLoginResult> {
  await registerSession(userId);
  await ensureUserUsageOnClient(userId);
  return { ok: true };
}
