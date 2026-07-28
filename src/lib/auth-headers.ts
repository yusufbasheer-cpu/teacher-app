import { supabase } from "@/lib/supabase";

/** Authorization headers for authenticated API routes. */
export async function getAuthHeaders(
  extra: Record<string, string> = {},
): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    ...extra,
    ...(session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}),
  };
}

/**
 * Authorization header only — for FormData uploads, where the browser must
 * set its own multipart Content-Type (with boundary). Setting Content-Type
 * manually on a FormData body breaks the upload.
 */
export async function getAuthOnlyHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}
