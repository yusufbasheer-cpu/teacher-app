import { SCHOOL_WELCOME_SESSION_KEY } from "@/lib/school-accounts";
import { supabase } from "@/lib/supabase";

export type SchoolEnrollmentClientResult =
  | {
      ok: true;
      blocked: false;
      individual: boolean;
      newlyJoined: boolean;
      welcomeMessage: string | null;
    }
  | {
      ok: false;
      blocked?: boolean;
      message: string;
    };

export async function runSchoolEnrollment(): Promise<SchoolEnrollmentClientResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { ok: false, message: "Session expired. Please log in again." };
  }

  let response: Response;
  try {
    response = await fetch("/api/auth/school-enrollment", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  } catch {
    return { ok: false, message: "Could not verify school account. Please try again." };
  }

  let body: {
    blocked?: boolean;
    message?: string;
    error?: string;
    individual?: boolean;
    newlyJoined?: boolean;
    welcomeMessage?: string | null;
  };

  try {
    body = (await response.json()) as typeof body;
  } catch {
    return { ok: false, message: "Could not verify school account. Please try again." };
  }

  if (response.status === 403 && body.blocked) {
    return { ok: false, blocked: true, message: body.message ?? "School account limit reached." };
  }

  if (!response.ok) {
    return { ok: false, message: body.error ?? "Could not verify school account. Please try again." };
  }

  if (body.welcomeMessage) {
    try {
      sessionStorage.setItem(SCHOOL_WELCOME_SESSION_KEY, body.welcomeMessage);
    } catch {
      /* ignore storage errors */
    }
  }

  return {
    ok: true,
    blocked: false,
    individual: Boolean(body.individual),
    newlyJoined: Boolean(body.newlyJoined),
    welcomeMessage: body.welcomeMessage ?? null,
  };
}
