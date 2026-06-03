import { NextResponse } from "next/server";
import { generateSlide13Body, type SlideGenParams } from "@/lib/ppt-individual-slide-generator";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(req: Request) {
  try {
    const params = (await req.json()) as SlideGenParams;
    const result = generateSlide13Body(params);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ body: `_(Slide 13 failed: ${msg})_`, notices: [msg] }, { status: 500 });
  }
}
