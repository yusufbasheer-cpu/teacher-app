import { NextResponse } from "next/server";
import { getUpgradePitch } from "@/lib/user-usage";
import { authenticateRequest, getOrCreateUserUsage } from "@/lib/user-usage-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const usage = await getOrCreateUserUsage(auth.supabase, auth.userId);
  if (!usage) {
    return NextResponse.json({ error: "Failed to load usage." }, { status: 500 });
  }

  const pitch = getUpgradePitch(usage.planType);

  return NextResponse.json({
    usage,
    upgradePitch: pitch,
  });
}
