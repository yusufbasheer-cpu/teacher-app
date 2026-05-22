import { NextResponse } from "next/server";
import JSZip from "jszip";
import { buildBlueprintDocxBuffer } from "@/lib/question-paper-blueprint-export";
import { buildDocxBuffer, sanitizeExportFileName } from "@/lib/lesson-plan-export";
import type { QuestionPaperBlueprint } from "@/lib/question-paper-blueprint";

export const runtime = "nodejs";

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  curriculumType?: string;
  timeAllowed?: string;
  questionPaper?: string;
  answerKey?: string;
  markingScheme?: string;
  blueprint?: QuestionPaperBlueprint;
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
  const answerKey = body.answerKey?.trim();
  const markingScheme = body.markingScheme?.trim();

  if (!subject || !grade || !topic || !questionPaper) {
    return NextResponse.json(
      { error: "subject, grade, topic, and questionPaper are required." },
      { status: 400 },
    );
  }

  try {
    const zip = new JSZip();
    const base = sanitizeExportFileName(`${grade}-${subject}-${topic}`) || "question-paper";

    const paperBuf = await buildDocxBuffer({
      documentTitle: "Question Paper",
      subject,
      grade,
      topic,
      content: questionPaper,
    });
    zip.file(`${base}-question-paper.docx`, paperBuf);

    if (answerKey || markingScheme) {
      const keyParts = [answerKey, markingScheme ? `## Marking Scheme\n\n${markingScheme}` : ""]
        .filter(Boolean)
        .join("\n\n---\n\n");
      const keyBuf = await buildDocxBuffer({
        documentTitle: "Answer Key & Marking",
        subject,
        grade,
        topic,
        content: keyParts,
      });
      zip.file(`${base}-answer-key.docx`, keyBuf);
    }

    if (body.blueprint) {
      const blueprintBuf = await buildBlueprintDocxBuffer({
        subject,
        grade,
        topic,
        curriculumType: body.curriculumType?.trim() ?? "",
        timeAllowed: body.timeAllowed?.trim() ?? "",
        blueprint: body.blueprint,
      });
      zip.file(`${base}-blueprint.docx`, blueprintBuf);
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${base}-complete-pack.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to build ZIP archive." }, { status: 500 });
  }
}
