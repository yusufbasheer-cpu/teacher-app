import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const PIN_REGEX = /^\d{6}$/;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`admin-pin:${ip}`, 5, FIFTEEN_MIN_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const configuredPin = process.env.SUPER_ADMIN_PIN?.trim();
  if (!configuredPin) {
    console.error("[super-admin/verify-pin] SUPER_ADMIN_PIN is not set — access blocked until configured");
    return NextResponse.json(
      { ok: false, error: "Admin PIN is not configured. Set SUPER_ADMIN_PIN in your environment variables." },
      { status: 503 },
    );
  }

  if (!PIN_REGEX.test(configuredPin)) {
    console.error("[super-admin/verify-pin] SUPER_ADMIN_PIN must be exactly 6 digits");
    return NextResponse.json(
      { ok: false, error: "Server PIN is misconfigured. Must be exactly 6 digits." },
      { status: 503 },
    );
  }

  let submittedPin: string | undefined;
  try {
    const body = (await req.json()) as { pin?: string };
    submittedPin = body.pin?.trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (!submittedPin || !PIN_REGEX.test(submittedPin)) {
    return NextResponse.json({ ok: false, error: "PIN must be exactly 6 digits." }, { status: 400 });
  }

  if (submittedPin !== configuredPin) {
    console.warn("[super-admin/verify-pin] Incorrect PIN attempt from IP:", ip);
    return NextResponse.json({ ok: false, error: "Incorrect PIN. Please try again." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
