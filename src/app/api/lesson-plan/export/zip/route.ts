import { NextResponse } from "next/server";
import { buildTeacherPackageZipBuffer, sanitizeExportFileName } from "@/lib/lesson-plan-export";
import { isTeacherPackagePlan } from "@/lib/lesson-plan";
import type { LessonPlanResult } from "@/lib/lesson-plan";

export const runtime = "nodejs";

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  lessonPlan?: LessonPlanResult;
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
  const lessonPlan = body.lessonPlan;

  if (!subject || !grade || !topic || !lessonPlan) {
    return NextResponse.json(
      { error: "subject, grade, topic, and lessonPlan are required." },
      { status: 400 },
    );
  }

  if (!isTeacherPackagePlan(lessonPlan)) {
    return NextResponse.json(
      { error: "ZIP export requires the full six-part teacher package." },
      { status: 400 },
    );
  }

  try {
    const buffer = await buildTeacherPackageZipBuffer({
      subject,
      grade,
      topic,
      lessonPlan,
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
