import { NextResponse } from "next/server";
import { buildDocxBuffer, sanitizeExportFileName } from "@/lib/lesson-plan-export";

export const runtime = "nodejs";

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  content?: string;
  variant?: "paper" | "answer-key";
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
  const content = body.content?.trim();
  const variant = body.variant === "answer-key" ? "answer-key" : "paper";

  if (!subject || !grade || !topic || !content) {
    return NextResponse.json(
      { error: "subject, grade, topic, and content are required." },
      { status: 400 },
    );
  }

  const documentTitle =
    variant === "answer-key" ? "Answer Key" : "Question Paper";
  const fileBaseName = variant === "answer-key" ? "answer-key" : "question-paper";

  try {
    const buffer = await buildDocxBuffer({
      documentTitle,
      subject,
      grade,
      topic,
      content,
    });
    const name =
      sanitizeExportFileName(`${grade}-${subject}-${topic}-${fileBaseName}`) || "question-paper";

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
    return NextResponse.json({ error: "Failed to build Word document." }, { status: 500 });
  }
}
