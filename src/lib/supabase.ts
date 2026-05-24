/**
 * Browser Supabase client (PKCE + session in cookies via @supabase/ssr).
 * Use this in Client Components for signInWithOAuth and client auth.
 */
export { createClient } from "@/lib/supabase-ssr";

import { createClient as createBrowserClient } from "@/lib/supabase-ssr";

/** Singleton browser client for existing imports. */
export const supabase = createBrowserClient();
