import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { gammaGate, getGammaConfig, GammaError } from "@/lib/gamma/config";
import { curateGammaThemes, listGammaThemes } from "@/lib/gamma/themes";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  if (!gammaGate(auth.email).available) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const themes = curateGammaThemes(await listGammaThemes(getGammaConfig()));
    return NextResponse.json({ themes }, { headers: { "cache-control": "private, max-age=300" } });
  } catch (error) {
    const message = error instanceof GammaError ? error.message : "Gamma themes are temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
