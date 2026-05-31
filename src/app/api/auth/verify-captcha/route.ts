import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";

export const runtime = "nodejs";

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`captcha:ip:${ip}`, 10, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

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
