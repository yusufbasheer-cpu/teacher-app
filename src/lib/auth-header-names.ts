/**
 * Header names used to forward the user identity that middleware (src/proxy.ts)
 * already verified via a real supabase.auth.getUser() call, so Server
 * Components don't have to pay for a second network round-trip to Supabase's
 * auth server on every navigation. Kept in their own zero-dependency module
 * since it's imported from both the middleware bundle (which can't import
 * next/headers) and Server Components (via src/lib/auth-headers.ts).
 */
export const USER_ID_HEADER = "x-layah-user-id";
export const USER_EMAIL_HEADER = "x-layah-user-email";
