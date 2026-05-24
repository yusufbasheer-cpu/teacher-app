import { NextResponse } from "next/server";
import { defaultFreeUsageSnapshot, getUpgradePitch } from "@/lib/user-usage";
import { authenticateRequest, getOrCreateUserUsage } from "@/lib/user-usage-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const usage = await getOrCreateUserUsage(auth.supabase, auth.userId);
  const resolved = usage ?? defaultFreeUsageSnapshot();

  if (!usage) {
    console.warn("[user-usage] GET /api/user-usage: using fallback snapshot (fail-open)", {
      userId: auth.userId,
    });
  }

  const pitch = getUpgradePitch(resolved.planType);

  return NextResponse.json({
    usage: resolved,
    upgradePitch: pitch,
  });
}
