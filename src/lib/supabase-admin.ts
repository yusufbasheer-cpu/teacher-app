import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isolationBlocksOperation } from "@/lib/environment-isolation";

/** Server-only Supabase client (bypasses RLS). Use only after verifying the user via JWT. */
export function getSupabaseServiceRole(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  // Defence in depth: an isolated experimental environment never hands out a service-role client it cannot prove is staging.
  if (isolationBlocksOperation()) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
