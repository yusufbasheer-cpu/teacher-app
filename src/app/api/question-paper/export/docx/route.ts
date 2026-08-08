import { NextResponse } from "next/server";
import { questionPaperDownloadFileName } from "@/lib/question-paper-download-names";
import { buildQuestionPaperDocxBuffer } from "@/lib/question-paper-export";
import { authenticateRequest } from "@/lib/user-usage-server";

export const runtime = "nodejs";

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  content?: string;
  totalMarks?: number;
  timeAllowed?: string;
};

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

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
  const totalMarks = Number(body.totalMarks);
  const timeAllowed = body.timeAllowed?.trim() ?? "1 hour";

  if (!subject || !grade || !topic || !content) {
    return NextResponse.json(
      { error: "subject, grade, topic, and content are required." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(totalMarks) || totalMarks < 1) {
    return NextResponse.json({ error: "totalMarks must be a positive number." }, { status: 400 });
  }

  try {
    const buffer = await buildQuestionPaperDocxBuffer({
      subject,
      grade,
      topic,
      totalMarks,
      timeAllowed,
      content,
    });
    const name = questionPaperDownloadFileName("paper", subject, grade);

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
    return NextResponse.json({ error: "Failed to build Word document." }, { status: 500 });
  }
}
