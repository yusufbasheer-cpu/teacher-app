import { NextResponse } from "next/server";
import { buildDocxBuffer, sanitizeExportFileName } from "@/lib/lesson-plan-export";
import { authenticateRequest } from "@/lib/user-usage-server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  documentTitle?: string;
  fileBaseName?: string;
  subject?: string;
  grade?: string;
  topic?: string;
  content?: string;
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
  const documentTitle = body.documentTitle?.trim();
  const fileBaseName = body.fileBaseName?.trim();
  const content = body.content?.trim();

  if (!subject || !grade || !topic || !documentTitle || !fileBaseName || !content) {
    return NextResponse.json(
      { error: "subject, grade, topic, documentTitle, fileBaseName, and content are required." },
      { status: 400 },
    );
  }

  try {
    const buffer = await buildDocxBuffer({
      documentTitle,
      subject,
      grade,
      topic,
      content,
    });
    const name =
      sanitizeExportFileName(`${grade}-${subject}-${topic}-${fileBaseName}`) || "worksheet-pack";

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
