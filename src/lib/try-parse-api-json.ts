import { USER_FACING_ERROR } from "@/lib/user-facing-errors";

/**
 * Safe parse for our own API responses (Next route handlers).
 * Avoids `response.json()` throwing when the platform returns HTML or plain text.
 */
export type TryParseApiJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; rawPreview: string };

const MAX_SHOW = 12_000;

export function tryParseApiJson<T>(
  raw: string,
  httpStatus: number,
  logLabel?: string,
): TryParseApiJsonResult<T> {
  const t = raw.trim();
  if (!t) {
    const technical = `Empty response body (HTTP ${httpStatus}).`;
    if (logLabel) console.error(`[${logLabel}]`, technical);
    return { ok: false, message: USER_FACING_ERROR, rawPreview: "" };
  }
  if (!t.startsWith("{") && !t.startsWith("[")) {
    const technical = `Server returned non-JSON (HTTP ${httpStatus}).`;
    if (logLabel) console.error(`[${logLabel}]`, technical, t.slice(0, 200));
    return { ok: false, message: USER_FACING_ERROR, rawPreview: t.slice(0, MAX_SHOW) };
  }
  try {
    return { ok: true, data: JSON.parse(t) as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (logLabel) console.error(`[${logLabel}] Invalid JSON (HTTP ${httpStatus}):`, msg);
    return {
      ok: false,
      message: USER_FACING_ERROR,
      rawPreview: t.slice(0, MAX_SHOW),
    };
  }
}
