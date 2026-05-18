/**
 * Validates image API keys from environment (server-side only).
 * Catches common misconfiguration: duplicate .env lines, URL pasted as Pexels key, etc.
 */

export function isInvalidPexelsApiKeyValue(value: string): boolean {
  const v = value.trim();
  if (v.length < 20) return true;
  if (/^https?:\/\//i.test(v)) return true;
  if (v.includes("://")) return true;
  if (/\.(com|net|org|io)\//i.test(v) && !v.startsWith("Bearer ")) return true;
  return false;
}

/**
 * Returns a usable Pexels API key or undefined (logs a clear reason when invalid).
 */
export function resolvePexelsApiKey(): string | undefined {
  const raw = process.env.PEXELS_API_KEY?.trim();
  if (!raw) {
    console.warn(
      "[pexels] PEXELS_API_KEY is not set — add your key from https://www.pexels.com/api/ to .env.local",
    );
    return undefined;
  }
  if (isInvalidPexelsApiKeyValue(raw)) {
    console.error(
      `[pexels] PEXELS_API_KEY looks invalid (length=${raw.length}, starts with "${raw.slice(0, 12)}…"). ` +
        "It must be the API key from pexels.com — not a website URL. " +
        "If .env.local defines PEXELS_API_KEY twice, remove the wrong line and restart the dev server.",
    );
    return undefined;
  }
  return raw;
}
