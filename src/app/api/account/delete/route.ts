import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`delete-account:ip:${ip}`, 3, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const { error } = await admin.auth.admin.deleteUser(auth.userId);

  if (error) {
    console.error("[delete-account] Failed to delete user:", auth.userId, error.message);
    return NextResponse.json({ error: "Could not delete account. Please contact support." }, { status: 500 });
  }

  console.log("[delete-account] Account deleted:", auth.userId);
  return NextResponse.json({ ok: true });
}
