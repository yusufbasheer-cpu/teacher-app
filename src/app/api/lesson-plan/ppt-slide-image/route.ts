import { NextResponse } from "next/server";
import { isValidCurriculumFramework } from "@/lib/curriculum-framework";
import { generateSinglePptSlideImageUrl, type PptSlideImageMeta } from "@/lib/fal-ppt-slide-images";
import { parsePptContentIntoSlides } from "@/lib/ppt-slide-parse";

export const runtime = "nodejs";
export const maxDuration = 600;

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  curriculumFramework?: string;
  pptContent?: string;
  slideIndex?: number;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const grade = body.grade?.trim();
  const topic = body.topic?.trim();
  const pptContent = body.pptContent?.trim();
  const slideIndex = typeof body.slideIndex === "number" ? body.slideIndex : Number.NaN;
  const curriculumFramework =
    typeof body.curriculumFramework === "string" ? body.curriculumFramework.trim() : "";

  if (!subject || !grade || !topic || !pptContent || !Number.isInteger(slideIndex) || slideIndex < 0) {
    return NextResponse.json(
      { error: "subject, grade, topic, pptContent, and non-negative integer slideIndex are required." },
      { status: 400 },
    );
  }

  if (!isValidCurriculumFramework(curriculumFramework)) {
    return NextResponse.json({ error: "Invalid curriculumFramework." }, { status: 400 });
  }

  const slides = parsePptContentIntoSlides(pptContent);
  if (slideIndex >= slides.length) {
    return NextResponse.json(
      { error: `slideIndex out of range (0–${slides.length - 1}).` },
      { status: 400 },
    );
  }

  const slide = slides[slideIndex]!;
  const meta: PptSlideImageMeta = {
    subject,
    grade,
    topic,
    ...(curriculumFramework ? { curriculumFramework } : {}),
  };

  try {
    const url = await generateSinglePptSlideImageUrl(meta, slide);
    return NextResponse.json({ slideIndex, url });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message, slideIndex, url: null }, { status: 500 });
  }
}
