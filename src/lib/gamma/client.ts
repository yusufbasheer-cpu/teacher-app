import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { GammaError, type GammaConfig } from "./config";

export type GammaCredits = { deducted?: number; remaining?: number };

export type GammaStatusResult =
  | { state: "pending" }
  | { state: "completed"; exportUrl?: string; gammaUrl?: string; credits: GammaCredits }
  | { state: "failed"; message: string; statusCode?: number; credits: GammaCredits };

export type GammaDeps = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Resolves ALL addresses of a host (injectable for tests). */
  resolveHost?: (host: string) => Promise<string[]>;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const defaultResolve = async (host: string) => (await lookup(host, { all: true })).map((a) => a.address);

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

/**
 * ONE HTTP call with an abort timeout = min(requestTimeoutMs, time left before the overall deadline).
 * Distinguishes a per-request timeout from running out of the overall budget.
 * Resolves with the Response; rejects with GammaError(request_timeout | deadline_exceeded) on abort,
 * or rethrows the transport error (caller decides what an unreachable response means for billing).
 */
async function timedFetch(
  doFetch: typeof fetch,
  url: string | URL,
  init: RequestInit,
  config: Pick<GammaConfig, "requestTimeoutMs">,
  deadline: number,
  now: () => number,
  timeoutMs = config.requestTimeoutMs,
): Promise<Response> {
  const remaining = deadline - now();
  if (remaining <= 0) throw new GammaError("deadline_exceeded", "Overall Gamma time budget exhausted before the request.");
  const limit = Math.min(timeoutMs, remaining);
  try {
    return await doFetch(url, { ...init, signal: AbortSignal.timeout(limit) });
  } catch (e) {
    const name = (e as { name?: string } | null)?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw limit < timeoutMs
        ? new GammaError("deadline_exceeded", "Overall Gamma time budget exhausted during a request.")
        : new GammaError("request_timeout", `A Gamma request timed out after ${Math.round(limit / 1000)}s.`);
    }
    throw e;
  }
}

/**
 * Submits ONE generation. Never retries unless Gamma answered 429 (a 429 means nothing was started).
 * Any outcome where Gamma may have accepted the job but we got no usable answer (network error, request
 * timeout, 5xx, missing id) is reported as `submission_unknown` so the caller keeps the user locked out
 * of a second paid submission. Gamma documents no idempotency key and no way to look a job up other than by id.
 */
export async function createGeneration(
  config: GammaConfig,
  request: Record<string, unknown>,
  deps: GammaDeps,
  deadline: number,
): Promise<{ generationId: string; retryCount: number }> {
  const doFetch = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  let retryCount = 0;
  for (;;) {
    // Budget already gone BEFORE sending: nothing was submitted, so this is a definite (unbilled) failure.
    if (deadline - now() <= 0) throw new GammaError("deadline_exceeded", "Overall Gamma time budget exhausted before submitting.");
    let res: Response;
    try {
      res = await timedFetch(
        doFetch,
        `${config.baseUrl}/generations`,
        { method: "POST", headers: { "X-API-KEY": config.apiKey, "Content-Type": "application/json" }, body: JSON.stringify(request) },
        config,
        deadline,
        now,
      );
    } catch {
      // Anything after the request started (abort, timeout, network) is an UNKNOWN outcome, never a plain failure.
      throw new GammaError("submission_unknown", "The Gamma create request got no usable response; it may or may not have started a paid generation.");
    }
    const body = await readJson(res);
    if (res.ok) {
      const generationId = typeof body.generationId === "string" ? body.generationId : "";
      if (!generationId) throw new GammaError("submission_unknown", "Gamma accepted the request but returned no generationId.");
      return { generationId, retryCount };
    }
    if (res.status === 429 && retryCount < 2) {
      retryCount++;
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : config.pollIntervalMs * retryCount, 10_000);
      if (now() + waitMs >= deadline) throw mapHttpError(429, body);
      await sleep(waitMs);
      continue;
    }
    if (res.status >= 500) {
      throw new GammaError("submission_unknown", `Gamma returned HTTP ${res.status} to the create request; it may have started a paid generation.`, { status: res.status });
    }
    throw mapHttpError(res.status, body);
  }
}

/** One status lookup (also used to reconcile/resume a stored generation id). */
export async function getGeneration(
  config: GammaConfig,
  generationId: string,
  deps: GammaDeps,
  deadline: number,
): Promise<GammaStatusResult> {
  const doFetch = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const res = await timedFetch(
    doFetch,
    `${config.baseUrl}/generations/${encodeURIComponent(generationId)}`,
    { headers: { "X-API-KEY": config.apiKey } },
    config,
    deadline,
    now,
  );
  const body = await readJson(res);
  if (!res.ok) throw mapHttpError(res.status, body, generationId);
  const credits = (body.credits && typeof body.credits === "object" ? body.credits : {}) as GammaCredits;
  if (body.status === "completed") {
    return {
      state: "completed",
      exportUrl: typeof body.exportUrl === "string" ? body.exportUrl : undefined,
      gammaUrl: typeof body.gammaUrl === "string" ? body.gammaUrl : undefined,
      credits,
    };
  }
  if (body.status === "failed") {
    const err = body.error as { message?: string; statusCode?: number } | undefined;
    return { state: "failed", message: (err?.message ?? "unknown").slice(0, 300), statusCode: err?.statusCode, credits };
  }
  return { state: "pending" };
}

/**
 * Polls until terminal. Two separate limits: the per-invocation polling window (poll_timeout: the job
 * keeps running and is resumed later) and the overall deadline (deadline_exceeded). Transient poll
 * errors are tolerated up to maxPollErrors in a row. This function can never create a generation.
 */
export async function pollGeneration(
  config: GammaConfig,
  generationId: string,
  deps: GammaDeps,
  deadline: number,
): Promise<{ result: Exclude<GammaStatusResult, { state: "pending" }>; pollCount: number }> {
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const pollEnd = Math.min(deadline, now() + config.pollTimeoutMs);
  let pollCount = 0;
  let consecutiveErrors = 0;
  while (now() < pollEnd) {
    pollCount++;
    try {
      const r = await getGeneration(config, generationId, deps, deadline);
      consecutiveErrors = 0;
      if (r.state !== "pending") return { result: r, pollCount };
    } catch (e) {
      const transient = e instanceof GammaError ? ["request_timeout", "rate_limited", "api_error"].includes(e.code) : true;
      if (!transient) throw e;
      if (e instanceof GammaError && e.code === "api_error" && (e.extra.status ?? 500) < 500) throw e;
      if (++consecutiveErrors >= config.maxPollErrors) {
        throw new GammaError("api_error", "Gamma status polling kept failing.", { generationId });
      }
    }
    await sleep(Math.min(config.pollIntervalMs, Math.max(0, pollEnd - now())));
  }
  throw new GammaError(
    deadline <= pollEnd && now() >= deadline ? "deadline_exceeded" : "poll_timeout",
    "Gamma has not finished yet. The generation keeps running; retry the same export shortly and it will resume without a new charge.",
    { generationId },
  );
}

// ── export download ────────────────────────────────────────────────────────────

export function hostMatches(host: string, allowlist: readonly string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return allowlist.some((entry) =>
    entry.startsWith("*.") ? h.endsWith(entry.slice(1)) && h.length > entry.length - 1 : h === entry,
  );
}

export function isPrivateAddress(addr: string): boolean {
  const v = isIP(addr);
  if (v === 4) {
    const [a, b] = addr.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (v === 6) {
    const l = addr.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l);
    if (mapped) return isPrivateAddress(mapped[1]);
    return l === "::" || l === "::1" || l.startsWith("fc") || l.startsWith("fd") || /^fe[89ab]/.test(l) || l.startsWith("ff");
  }
  return true; // not an IP at all: fail closed
}

const OK_CONTENT_TYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/octet-stream",
  "binary/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
];

/**
 * Downloads the export link. The link is a bearer secret (anyone holding it can download for ~1 week):
 * it is never logged or included in errors (only the host), the API key is never sent to it, and:
 * HTTPS only, no credentials/port in the URL, exact-host allowlist, every resolved address must be public,
 * redirects refused, content-type + declared and streamed size limited, abort timeout, zip magic bytes.
 * Residual limit: DNS is checked before fetch(); a rebinding attacker would need control of an allowlisted host.
 */
export async function downloadGammaExport(
  config: GammaConfig,
  exportUrl: string,
  deps: GammaDeps,
  deadline: number,
): Promise<Buffer> {
  const doFetch = deps.fetchImpl ?? fetch;
  const resolve = deps.resolveHost ?? defaultResolve;
  const now = deps.now ?? Date.now;
  let url: URL;
  try {
    url = new URL(exportUrl);
  } catch {
    throw new GammaError("download_rejected", "Export URL is not a valid URL.");
  }
  if (url.protocol !== "https:") throw new GammaError("download_rejected", "Export URL is not HTTPS.");
  if (url.username || url.password || (url.port && url.port !== "443")) {
    throw new GammaError("download_rejected", "Export URL has credentials or a non-standard port.");
  }
  if (!hostMatches(url.hostname, config.exportHosts)) {
    throw new GammaError(
      "download_rejected",
      `Export host "${url.hostname}" is not in GAMMA_EXPORT_HOST_ALLOWLIST. The generation is already paid for and stays resumable: verify the host belongs to Gamma, add it, and retry (no new charge).`,
    );
  }
  let addrs: string[];
  try {
    addrs = await resolve(url.hostname);
  } catch {
    throw new GammaError("download_rejected", "Could not resolve the export host; refusing to download.");
  }
  if (addrs.length === 0 || addrs.some(isPrivateAddress)) {
    throw new GammaError("download_rejected", "Export host resolves to a non-public address; refusing to download.");
  }
  const res = await timedFetch(doFetch, url, { redirect: "manual" }, config, deadline, now, config.requestTimeoutMs * 2).catch((e) => {
    if (e instanceof GammaError) throw e;
    throw new GammaError("download_rejected", "Export download failed to connect.");
  });
  if (res.status >= 300 && res.status < 400) throw new GammaError("download_rejected", "Export download attempted to redirect.");
  if (!res.ok || !res.body) throw new GammaError("download_rejected", `Export download failed (HTTP ${res.status}).`);
  const ctype = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (ctype && !OK_CONTENT_TYPES.includes(ctype)) {
    throw new GammaError("download_rejected", `Export has unexpected content-type "${ctype.slice(0, 60)}".`);
  }
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > config.maxDownloadBytes) throw new GammaError("download_rejected", "Export file exceeds the size limit.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  try {
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
  } catch (e) {
    if (e instanceof GammaError) throw e;
    throw new GammaError("request_timeout", "Export download timed out or was interrupted; it will be retried on the next attempt without a new charge.");
  }
  const buf = Buffer.concat(chunks);
  if (buf.length < 4 || buf.subarray(0, 2).toString() !== "PK") {
    throw new GammaError("invalid_export", "Downloaded export is not a valid PPTX (zip) file.");
  }
  return buf;
}
