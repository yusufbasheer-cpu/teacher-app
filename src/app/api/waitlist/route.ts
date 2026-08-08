import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ipLimit = checkRateLimit(`waitlist:ip:${getClientIp(req)}`, 10, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  let body: { email?: string; plan_interested?: string | null };
  try {
    body = (await req.json()) as { email?: string; plan_interested?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    console.error("[waitlist] Supabase service role client is null — check SUPABASE_SERVICE_ROLE_KEY env var");
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const insertPayload = { email, plan_interested: body.plan_interested ?? null };
  console.log("[waitlist] attempting insert:", insertPayload);

  const { error } = await supabase.from("waitlist").insert(insertPayload);

  if (error) {
    console.error("[waitlist] insert failed — code:", error.code, "| message:", error.message, "| details:", error.details, "| hint:", error.hint);
    return NextResponse.json({ error: "Failed to save. Please try again." }, { status: 500 });
  }

  console.log("[waitlist] email saved:", email, "plan:", body.plan_interested ?? "unknown");
  return NextResponse.json({ ok: true });
}
