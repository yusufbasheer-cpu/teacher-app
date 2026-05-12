/**
 * Safe parse for our own API responses (Next route handlers).
 * Avoids `response.json()` throwing when the platform returns HTML or plain text.
 */
export type TryParseApiJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; rawPreview: string };

const MAX_SHOW = 12_000;

export function tryParseApiJson<T>(raw: string, httpStatus: number): TryParseApiJsonResult<T> {
  const t = raw.trim();
  if (!t) {
    return {
      ok: false,
      message: `Empty response body (HTTP ${httpStatus}).`,
      rawPreview: "",
    };
  }
  if (!t.startsWith("{") && !t.startsWith("[")) {
    return {
      ok: false,
      message: `Server returned non-JSON (HTTP ${httpStatus}). First characters:\n${t.slice(0, 200)}`,
      rawPreview: t.slice(0, MAX_SHOW),
    };
  }
  try {
    return { ok: true, data: JSON.parse(t) as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `Invalid JSON (HTTP ${httpStatus}): ${msg}`,
      rawPreview: t.slice(0, MAX_SHOW),
    };
  }
}
