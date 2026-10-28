import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { sendWelcomeEmailIfNew } from "@/lib/welcome-email";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit(`email:ip:${ip}`, 3, HOUR_MS, "bounded-fallback");
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id || !user?.email) {
      console.log("[welcome-email API] No authenticated user found");
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    console.log("[welcome-email API] Triggering welcome email for:", user.email);
    const result = await sendWelcomeEmailIfNew(user.id, user.email, user.user_metadata?.full_name);

    if (result === "failed") {
      return NextResponse.json({ ok: false }, { status: 502 });
    }

    return NextResponse.json({ ok: true, status: result });
  } catch (err) {
    console.error("[welcome-email API] error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
