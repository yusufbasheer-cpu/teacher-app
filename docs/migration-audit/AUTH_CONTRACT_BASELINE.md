# Auth Contract Baseline

Date: 2026-08-31

## Browser Auth Flow

- Browser code uses the shared Supabase browser client.
- `getAuthHeaders()` reads the current session and adds `Authorization: Bearer <access_token>` for JSON requests.
- `getAuthOnlyHeaders()` does the same without forcing a `Content-Type`, which keeps `FormData` uploads valid.

## Middleware / Server Boundary

- `src/proxy.ts` verifies the user once per request and forwards identity through `x-layah-user-id` and `x-layah-user-email`.
- `src/lib/verified-user.ts` trusts those forwarded headers when present and falls back to `supabase.auth.getUser()` only when needed.

## Keep Stable

- Authentication headers and cookies must remain consistent across later API-client and backend migrations.
- Do not import server-only auth behavior into client bundles.

