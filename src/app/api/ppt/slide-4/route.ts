import { NextResponse } from "next/server";
import { generateSlide4Body, type SlideGenParams } from "@/lib/ppt-individual-slide-generator";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(req: Request) {
  try {
    const params = (await req.json()) as SlideGenParams;
    const result = generateSlide4Body(params);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ body: `_(Slide 4 failed: ${msg})_`, notices: [msg] }, { status: 500 });
  }
}
