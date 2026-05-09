import { NextResponse } from "next/server";
import { buildPptxFromPptContent, sanitizeExportFileName } from "@/lib/lesson-plan-export";

export const runtime = "nodejs";

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  pptContent?: string;
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

  if (!subject || !grade || !topic || !pptContent) {
    return NextResponse.json(
      { error: "subject, grade, topic, and pptContent are required." },
      { status: 400 },
    );
  }

  try {
    const buffer = await buildPptxFromPptContent({ subject, grade, topic, pptContent });
    const name = sanitizeExportFileName(`${grade}-${subject}-${topic}-ppt`) || "ppt-content";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${name}.pptx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to build PowerPoint." }, { status: 500 });
  }
}
