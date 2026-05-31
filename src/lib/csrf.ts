const ALLOWED_ORIGINS = new Set([
  "https://layah.in",
  "https://www.layah.in",
  "http://localhost:3000",
  "http://localhost:3001",
  ...(process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : []),
]);

type CsrfResult = { ok: true } | { ok: false; response: Response };

/** Check Origin header on state-changing requests. Returns {ok:false} for cross-origin mutations. */
export function checkCsrf(req: Request): CsrfResult {
  const origin = req.headers.get("origin");

  // No Origin header = same-origin server-to-server request → allow
  if (!origin) return { ok: true };

  if (ALLOWED_ORIGINS.has(origin)) return { ok: true };

  console.warn("[csrf] Blocked request from origin:", origin);
  return {
    ok: false,
    response: new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    ),
  };
}
