import { GammaError, type GammaConfig } from "./config";

export type GammaCredits = { deducted?: number; remaining?: number };

export type GammaResult = {
  generationId: string;
  gammaUrl?: string;
  exportUrl: string;
  credits: GammaCredits;
  pollCount: number;
  /** Times the create call was retried after a 429 (safe: a 429 means nothing was started). */
  retryCount: number;
};

export type GammaDeps = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const j = await res.json();
    return j && typeof j === "object" ? (j as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function apiMessage(body: Record<string, unknown>): string {
  const m = body.message ?? (body.error as { message?: unknown } | undefined)?.message ?? body.error;
  return typeof m === "string" ? m.slice(0, 300) : "";
}

function mapHttpError(status: number, body: Record<string, unknown>, generationId?: string): GammaError {
  const detail = apiMessage(body);
  const extra = { status, generationId };
  if (status === 401) return new GammaError("invalid_credentials", "Gamma rejected the API key.", extra);
  if (status === 402) return new GammaError("insufficient_credits", "Gamma workspace has insufficient credits.", extra);
  if (status === 403) {
    return /credit/i.test(detail)
      ? new GammaError("insufficient_credits", "Gamma workspace has insufficient credits.", extra)
      : new GammaError("invalid_credentials", `Gamma denied access (API access may require a paid plan). ${detail}`.trim(), extra);
  }
  if (status === 400) return new GammaError("bad_request", `Gamma rejected the request: ${detail}`.trim(), extra);
  if (status === 429) return new GammaError("rate_limited", "Gamma rate limit reached.", extra);
  return new GammaError("api_error", `Gamma API error (HTTP ${status}). ${detail}`.trim(), extra);
}

/** Submits one generation and polls it to completion. Never submits a second generation on failure. */
export async function runGammaGeneration(
  config: GammaConfig,
  request: Record<string, unknown>,
  deps: GammaDeps = {},
): Promise<GammaResult> {
  const doFetch = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const headers = { "X-API-KEY": config.apiKey, "Content-Type": "application/json" };
  const started = now();

  // ── create (retry only on 429: nothing was started, so no duplicate generation is possible) ──
  let retryCount = 0;
  let generationId = "";
  for (;;) {
    const res = await doFetch(`${config.baseUrl}/generations`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });
    const body = await readJson(res);
    if (res.ok) {
      generationId = typeof body.generationId === "string" ? body.generationId : "";
      if (!generationId) throw new GammaError("api_error", "Gamma response had no generationId.");
      break;
    }
    if (res.status === 429 && retryCount < 2) {
      retryCount++;
      await sleep(config.pollIntervalMs * retryCount);
      continue;
    }
    throw mapHttpError(res.status, body);
  }

  // ── poll ──
  let pollCount = 0;
  let consecutiveErrors = 0;
  while (now() - started < config.timeoutMs) {
    await sleep(config.pollIntervalMs);
    pollCount++;
    let res: Response;
    try {
      res = await doFetch(`${config.baseUrl}/generations/${encodeURIComponent(generationId)}`, {
        headers: { "X-API-KEY": config.apiKey },
      });
    } catch {
      if (++consecutiveErrors >= config.maxPollErrors) {
        throw new GammaError("api_error", "Lost connection to Gamma while polling.", { generationId });
      }
      continue;
    }
    const body = await readJson(res);
    if (!res.ok) {
      if (res.status === 429 || res.status >= 500) {
        if (++consecutiveErrors >= config.maxPollErrors) throw mapHttpError(res.status, body, generationId);
        continue;
      }
      throw mapHttpError(res.status, body, generationId);
    }
    consecutiveErrors = 0;
    const credits = (body.credits && typeof body.credits === "object" ? body.credits : {}) as GammaCredits;
    if (body.status === "completed") {
      const exportUrl = typeof body.exportUrl === "string" ? body.exportUrl : "";
      if (!exportUrl) {
        throw new GammaError("generation_failed", "Gamma completed but returned no PPTX export URL.", { generationId });
      }
      return {
        generationId,
        gammaUrl: typeof body.gammaUrl === "string" ? body.gammaUrl : undefined,
        exportUrl,
        credits,
        pollCount,
        retryCount,
      };
    }
    if (body.status === "failed") {
      const err = body.error as { message?: string; statusCode?: number } | undefined;
      if (err?.statusCode === 402 || /credit/i.test(err?.message ?? "")) {
        throw new GammaError("insufficient_credits", "Gamma generation failed: insufficient credits.", { generationId });
      }
      throw new GammaError("generation_failed", `Gamma generation failed: ${(err?.message ?? "unknown").slice(0, 300)}`, { generationId });
    }
  }
  throw new GammaError("timeout", `Gamma generation did not finish within ${Math.round(config.timeoutMs / 1000)}s.`, { generationId });
}

/**
 * Downloads the signed export URL. The URL is a bearer secret: it is never logged, the API key is
 * never sent to it, redirects are refused, host/size/magic bytes are checked.
 */
export async function downloadGammaExport(
  config: GammaConfig,
  exportUrl: string,
  deps: GammaDeps = {},
): Promise<Buffer> {
  const doFetch = deps.fetchImpl ?? fetch;
  let url: URL;
  try {
    url = new URL(exportUrl);
  } catch {
    throw new GammaError("download_rejected", "Export URL is not a valid URL.");
  }
  const host = url.hostname.toLowerCase();
  const allowed = config.exportHostSuffixes.some((s) => host === s || host.endsWith(`.${s}`));
  if (url.protocol !== "https:" || !allowed) {
    throw new GammaError("download_rejected", `Export URL host "${host}" is not on the allowlist (GAMMA_EXPORT_HOST_ALLOWLIST).`);
  }
  const res = await doFetch(url, { redirect: "manual" });
  if (res.status >= 300 && res.status < 400) throw new GammaError("download_rejected", "Export download attempted to redirect.");
  if (!res.ok || !res.body) throw new GammaError("download_rejected", `Export download failed (HTTP ${res.status}).`);
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > config.maxDownloadBytes) {
    throw new GammaError("download_rejected", "Export file exceeds the size limit.");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > config.maxDownloadBytes) {
      await reader.cancel();
      throw new GammaError("download_rejected", "Export file exceeds the size limit.");
    }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks);
  if (buf.length < 4 || buf.subarray(0, 2).toString() !== "PK") {
    throw new GammaError("invalid_export", "Downloaded export is not a valid PPTX (zip) file.");
  }
  return buf;
}
