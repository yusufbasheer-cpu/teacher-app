import { NextResponse } from "next/server";
import JSZip from "jszip";
import { buildBlueprintTextDocxBuffer } from "@/lib/question-paper-blueprint-export";
import {
  buildQuestionPaperDocxBuffer,
  questionPaperDownloadFileName,
} from "@/lib/question-paper-export";

export const runtime = "nodejs";

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  curriculumType?: string;
  timeAllowed?: string;
  totalMarks?: number;
  questionPaper?: string;
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
  const questionPaper = body.questionPaper?.trim();
  const blueprintText = body.blueprintText?.trim();
  const totalMarks = Number(body.totalMarks);
  const timeAllowed = body.timeAllowed?.trim() ?? "1 hour";
  const curriculumType = body.curriculumType?.trim() ?? "";

  if (!subject || !grade || !topic || !questionPaper) {
    return NextResponse.json(
      { error: "subject, grade, topic, and questionPaper are required." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(totalMarks) || totalMarks < 1) {
    return NextResponse.json({ error: "totalMarks must be a positive number." }, { status: 400 });
  }

  try {
    const zip = new JSZip();

    const paperBuf = await buildQuestionPaperDocxBuffer({
      subject,
      grade,
      topic,
      totalMarks,
      timeAllowed,
      content: questionPaper,
    });
    zip.file(questionPaperDownloadFileName("paper", subject, grade), paperBuf);

    if (blueprintText) {
      const blueprintBuf = await buildBlueprintTextDocxBuffer({
        subject,
        grade,
        topic,
        curriculumType,
        timeAllowed,
        totalMarks,
        blueprintText,
      });
      zip.file(questionPaperDownloadFileName("blueprint", subject, grade), blueprintBuf);
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipName = questionPaperDownloadFileName("zip", subject, grade);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to build ZIP archive." }, { status: 500 });
  }
}
