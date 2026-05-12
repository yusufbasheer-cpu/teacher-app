/**
 * Logs the exact HTTP response from DeepSeek before any parsing (server-side only).
 * Truncates very large bodies to avoid blowing up hosting log limits.
 */
const MAX_CHARS = 100_000;

export function logDeepSeekRawResponse(label: string, res: Response, rawBody: string): void {
  const truncated =
    rawBody.length > MAX_CHARS ? `${rawBody.slice(0, MAX_CHARS)}\n…[truncated after ${MAX_CHARS} chars]` : rawBody;

  console.log("[DeepSeek RAW]", label, {
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get("content-type"),
    bodyLength: rawBody.length,
  });
  console.log("[DeepSeek RAW body]", label, truncated);
}
