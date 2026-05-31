import { NextResponse } from "next/server";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  // Strict rate limit — 5 attempts per 15 minutes per IP
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`admin-pin:${ip}`, 5, FIFTEEN_MIN_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isSuperAdminEmail(user?.email)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const pin = process.env.SUPER_ADMIN_PIN?.trim();
  if (!pin) {
    // PIN not configured — allow access (backward compatible, log warning)
    console.warn("[super-admin/verify-pin] SUPER_ADMIN_PIN not set — PIN check skipped");
    return NextResponse.json({ ok: true });
  }

  let submittedPin: string | undefined;
  try {
    const body = (await req.json()) as { pin?: string };
    submittedPin = body.pin?.trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (!submittedPin || submittedPin !== pin) {
    console.warn("[super-admin/verify-pin] Incorrect PIN attempt from IP:", ip);
    return NextResponse.json({ ok: false, error: "Incorrect PIN." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
