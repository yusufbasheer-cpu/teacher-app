import { NextResponse } from "next/server";
import { logDeepSeekRawResponse } from "@/lib/deepseek-log-raw";

export const runtime = "nodejs";
export const maxDuration = 30;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

/**
 * Lightweight check that DEEPSEEK_API_KEY works (GET).
 * Open in the browser while debugging; does not expose the key.
 */
export async function GET() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "DEEPSEEK_API_KEY is missing.", keyPresent: false },
      { status: 500 },
    );
  }
  if (apiKey.length < 12) {
    return NextResponse.json(
      {
        ok: false,
        message: "DEEPSEEK_API_KEY looks too short to be valid.",
        keyPresent: true,
        keyLength: apiKey.length,
      },
      { status: 500 },
    );
  }

  let res: Response;
  try {
    res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0,
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply with exactly: ok" }],
      }),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Network error calling DeepSeek.",
        keyPresent: true,
        keyLength: apiKey.length,
      },
      { status: 502 },
    );
  }

  const raw = await res.text();
  logDeepSeekRawResponse("deepseek-ping", res, raw);

  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        httpStatus: res.status,
        message: `DeepSeek returned HTTP ${res.status}. See server logs for full raw body.`,
        rawPreview: raw.slice(0, 4000),
        keyPresent: true,
        keyLength: apiKey.length,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    httpStatus: res.status,
    message: "DeepSeek responded successfully. Key appears valid.",
    keyPresent: true,
    keyLength: apiKey.length,
    rawPreview: raw.slice(0, 500),
  });
}
