import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser client — stores PKCE verifier and session in cookies (required for SSR OAuth).
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/** Server Components, route handlers, and server actions. */
export async function createServerSupabaseClient() {
  const cookieStore = await import("next/headers").then((m) => m.cookies());

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* setAll from Server Component — middleware refreshes session */
        }
      },
    },
  });
}

/** Middleware — refresh session and forward auth cookies on the response. */
export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse,
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
