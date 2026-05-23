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
