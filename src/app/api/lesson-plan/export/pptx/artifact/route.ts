import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { GammaError, gammaGate } from "@/lib/gamma/config";
import { SupabaseGammaStore } from "@/lib/gamma/store";
import { readGammaArtifact } from "@/lib/gamma/artifact";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const gate = gammaGate(auth.email);
  if (!gate.available) return NextResponse.json({ error: "Gamma is unavailable in this environment." }, { status: 403 });
  let body: { requestHash?: unknown; themeId?: unknown; imageSource?: unknown; imageStyle?: unknown };
  try { body = await req.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const requestHash = typeof body.requestHash === "string" && /^[a-f0-9]{64}$/.test(body.requestHash) ? body.requestHash : "";
  if (!requestHash) return NextResponse.json({ error: "A valid generation fingerprint is required." }, { status: 400 });
  try {
    const row = await new SupabaseGammaStore().findReusableArtifact({ userId: auth.userId, requestHash, themeId: typeof body.themeId === "string" ? body.themeId : null, imageSource: typeof body.imageSource === "string" ? body.imageSource : null, imageStyle: typeof body.imageStyle === "string" ? body.imageStyle : null });
    if (!row?.artifactPath || row.validationReport?.verdict !== "passed") return NextResponse.json({ error: "No validated Gamma PowerPoint is available." }, { status: 404 });
    const buffer = await readGammaArtifact(row.artifactPath);
    return new NextResponse(new Uint8Array(buffer), { status: 200, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": 'attachment; filename="lesson-gamma.pptx"', "Cache-Control": "private, no-store", "X-Layah-PPT-Provider": "gamma", "X-Layah-Gamma-Validation": "passed" } });
  } catch (error) {
    const message = error instanceof GammaError ? error.message : "Stored Gamma PowerPoint is unavailable.";
    return NextResponse.json({ error: message }, { status: error instanceof GammaError && error.code === "store_unavailable" ? 503 : 404 });
  }
}
