import { NextResponse } from "next/server";
import { formatDocxAflAppendix, sanitizeAflSelections } from "@/lib/afl-tools";
import { buildDocxBuffer, sanitizeExportFileName } from "@/lib/lesson-plan-export";
import { authenticateRequest } from "@/lib/user-usage-server";
import { parseKeyWords } from "@/lib/lesson-key-words";
import { checkRateLimit, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";

export const runtime = "nodejs";

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  documentTitle?: string;
  fileBaseName?: string;
  content?: string;
  aflSelections?: unknown;
  chapter?: string;
  keyWords?: unknown;
};

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const userLimit = await checkRateLimit(`export:lesson-plan-docx:user:${auth.userId}`, 20, HOUR_MS);
  if (!userLimit.ok) return rateLimitResponse(userLimit.resetInSeconds, userLimit.unavailable);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const grade = body.grade?.trim();
  const topic = body.topic?.trim() || "Lesson";
  const documentTitle = body.documentTitle?.trim();
  const fileBaseName = body.fileBaseName?.trim();
  const content = body.content?.trim();
  const isFullLessonPlanExport =
    body.fileBaseName?.trim() === "lesson-plan" || body.documentTitle?.trim() === "Lesson Plan";
  const aflAppendix = isFullLessonPlanExport
    ? formatDocxAflAppendix(sanitizeAflSelections(body.aflSelections))
    : "";

  if (!subject || !grade || !documentTitle || !fileBaseName || !content) {
    return NextResponse.json(
      { error: "subject, grade, documentTitle, fileBaseName, and content are required." },
      { status: 400 },
    );
  }

  try {
    const buffer = await buildDocxBuffer({
      documentTitle,
      subject,
      grade,
      topic,
      content: aflAppendix ? `${content}${aflAppendix}` : content,
      chapter: body.chapter?.trim() || undefined,
      keyWords: parseKeyWords(body.keyWords),
    });
    const name = sanitizeExportFileName(`${grade}-${subject}-${topic}-${fileBaseName}`) || "document";

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
