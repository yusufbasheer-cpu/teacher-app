import { NextResponse } from "next/server";
import { buildBlueprintTextDocxBuffer } from "@/lib/question-paper-blueprint-export";
import { questionPaperDownloadFileName } from "@/lib/question-paper-export";

export const runtime = "nodejs";

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  curriculumType?: string;
  timeAllowed?: string;
  totalMarks?: number;
  blueprintText?: string;
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
  const curriculumType = body.curriculumType?.trim() ?? "";
  const timeAllowed = body.timeAllowed?.trim() ?? "";
  const blueprintText = body.blueprintText?.trim();
  const totalMarks = Number(body.totalMarks);

  if (!subject || !grade || !topic || !blueprintText) {
    return NextResponse.json(
      { error: "subject, grade, topic, and blueprintText are required." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(totalMarks) || totalMarks < 1) {
    return NextResponse.json({ error: "totalMarks must be a positive number." }, { status: 400 });
  }

  try {
    const buffer = await buildBlueprintTextDocxBuffer({
      subject,
      grade,
      topic,
      curriculumType,
      timeAllowed,
      totalMarks,
      blueprintText,
    });
    const name = questionPaperDownloadFileName("blueprint", subject, grade);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to build blueprint Word document." }, { status: 500 });
  }
}
