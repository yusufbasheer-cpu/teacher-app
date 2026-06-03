import { NextResponse } from "next/server";
import { generateSlide8, type SlideGenParams } from "@/lib/ppt-individual-slide-generator";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const params = (await req.json()) as SlideGenParams;
    if (!params.topic || !params.subject || !params.grade) {
      return NextResponse.json({ error: "topic, subject, grade required" }, { status: 400 });
    }
    const result = await generateSlide8(params);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ body: `_(Slide 8 could not be generated: ${msg})_`, notices: [msg] }, { status: 500 });
  }
}
