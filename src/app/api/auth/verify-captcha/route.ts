import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";
import { resolveBackendRoute } from "@/lib/backend-routing";

export const runtime = "nodejs";

export const VERIFY_CAPTCHA_PYTHON_PROXY_TIMEOUT_MS = 5000;

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

function buildCaptchaProxyHeaders(incoming: Headers): Headers {
  const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json" });
  for (const name of ["x-forwarded-for", "x-real-ip"]) {
    const value = incoming.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function proxyCaptchaToPython(url: URL, headers: Headers, rawBody: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_CAPTCHA_PYTHON_PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: buildCaptchaProxyHeaders(headers),
      body: rawBody,
      signal: controller.signal,
      cache: "no-store",
    });
    const contentType = upstream.headers.get("content-type");
    const responseHeaders = new Headers();
    if (contentType) responseHeaders.set("content-type", contentType);
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`captcha:ip:${ip}`, 10, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  const decision = resolveBackendRoute("verify-captcha");

  if (decision.target === "python" && decision.pythonUrl) {
    const rawBody = await req.text();
    try {
      console.log("[backend-routing] Routing endpoint", {
        endpoint: "verify-captcha",
        backend: "python",
        fallback: false,
      });
      return await proxyCaptchaToPython(decision.pythonUrl, req.headers, rawBody);
    } catch (err) {
      // Deliberately NOT falling back to Next: Turnstile tokens are
      // single-use. If Python already reached Turnstile and consumed the
      // token before this transport failure occurred, a Next-side retry
      // would resubmit the same token and get a false rejection
      // (timeout-or-duplicate) — turning a valid captcha completion into
      // an apparent failure the caller never caused. See
      // docs/migration-audit/VERIFY_CAPTCHA_PYTHON_PARITY_CONTRACT.md.
      console.error(
        "[backend-routing] Python verify-captcha transport failed; no fallback (single-use token)",
        {
          endpoint: "verify-captcha",
          backend: "python",
          fallback: false,
          failure: err instanceof Error ? err.name : "unknown",
        },
      );
      return NextResponse.json(
        { ok: false, error: "Captcha verification is temporarily unavailable. Please try again." },
        { status: 502 },
      );
    }
  }

  console.log("[backend-routing] Routing endpoint", {
    endpoint: "verify-captcha",
    backend: "next",
    fallback: false,
    reason: decision.reason,
  });

  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();

  if (!secretKey) {
    return NextResponse.json({ ok: true });
  }

  let token: string | undefined;
  try {
    const body = (await req.json()) as { token?: string };
    token = body.token?.trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing captcha token." }, { status: 400 });
  }

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secretKey, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(5000),
      },
    );

    const data = (await res.json()) as TurnstileVerifyResponse;

    if (!data.success) {
      console.warn("[captcha] Turnstile verification failed:", data["error-codes"]);
      return NextResponse.json(
        { ok: false, error: "Captcha verification failed. Please try again." },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[captcha] Turnstile verify request failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: true });
  }
}
