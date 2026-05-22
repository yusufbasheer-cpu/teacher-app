import { NextResponse } from "next/server";
import { buildBlueprintDocxBuffer } from "@/lib/question-paper-blueprint-export";
import { sanitizeExportFileName } from "@/lib/lesson-plan-export";
import type { QuestionPaperBlueprint } from "@/lib/question-paper-blueprint";

export const runtime = "nodejs";

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  curriculumType?: string;
  timeAllowed?: string;
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
  const curriculumType = body.curriculumType?.trim() ?? "";
  const timeAllowed = body.timeAllowed?.trim() ?? "";
  const blueprint = body.blueprint;

  if (!subject || !grade || !topic || !blueprint) {
    return NextResponse.json(
      { error: "subject, grade, topic, and blueprint are required." },
      { status: 400 },
    );
  }

  try {
    const buffer = await buildBlueprintDocxBuffer({
      subject,
      grade,
      topic,
      curriculumType,
      timeAllowed,
      blueprint,
    });
    const name = sanitizeExportFileName(`${grade}-${subject}-${topic}-blueprint`) || "blueprint";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${name}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to build blueprint Word document." }, { status: 500 });
  }
}
