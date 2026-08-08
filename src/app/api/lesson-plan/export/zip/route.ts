import { NextResponse } from "next/server";
import { sanitizeAflSelections } from "@/lib/afl-tools";
import { buildTeacherPackageZipBuffer, sanitizeExportFileName } from "@/lib/lesson-plan-export";
import { hasTeacherPackageContent } from "@/lib/lesson-plan";
import type { LessonPlanResult } from "@/lib/lesson-plan";
import { authenticateRequest } from "@/lib/user-usage-server";

export const runtime = "nodejs";

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  lessonPlan?: LessonPlanResult;
  aflSelections?: unknown;
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
  const lessonPlan = body.lessonPlan;
  const aflSelections = sanitizeAflSelections(body.aflSelections);

  if (!subject || !grade || !topic || !lessonPlan) {
    return NextResponse.json(
      { error: "subject, grade, topic, and lessonPlan are required." },
      { status: 400 },
    );
  }

  if (!hasTeacherPackageContent(lessonPlan)) {
    return NextResponse.json(
      { error: "ZIP export requires at least one teacher-package section with content." },
      { status: 400 },
    );
  }

  try {
    const buffer = await buildTeacherPackageZipBuffer({
      subject,
      grade,
      topic,
      lessonPlan,
      ...(Object.keys(aflSelections).length > 0 ? { aflSelections } : {}),
    });
    const name = sanitizeExportFileName(`${grade}-${subject}-${topic}-package`) || "teacher-package";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${name}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to build ZIP archive." }, { status: 500 });
  }
}
