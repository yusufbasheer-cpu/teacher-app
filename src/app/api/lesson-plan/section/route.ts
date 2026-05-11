import { NextResponse } from "next/server";
import { buildCurriculumFrameworkSystemAddendum, isValidCurriculumFramework } from "@/lib/curriculum-framework";
import { generateFluxSectionImageForKey, formatFalError } from "@/lib/fal-flux-section-images";
import {
  buildMessagesForSingleSection,
  callDeepseekChat,
  parseSingleSectionFromResponse,
} from "@/lib/lesson-plan-deepseek";
import {
  SOURCE_MATERIAL_MAX_CHARS,
  TEACHER_PACKAGE_SECTIONS,
  type LessonPlanInput,
  type LessonPlanSectionRequestBody,
  type TeacherPackageSectionKey,
  isValidCurriculumType,
  isValidGradeYear,
  isValidSubjectOption,
} from "@/lib/lesson-plan";

export const runtime = "nodejs";
export const maxDuration = 600;

function validateInput(input: LessonPlanInput): string | null {
  if (!isValidCurriculumType(input.curriculumType.trim())) {
    return "Invalid curriculum type.";
  }
  if (!isValidGradeYear(input.grade.trim())) {
    return "Invalid grade / year group.";
  }
  if (!isValidSubjectOption(input.subject.trim())) {
    return "Invalid subject.";
  }
  if (input.topic.trim().length === 0) {
    return "Please enter a topic.";
  }
  if (input.learningObjectives.trim().length === 0) {
    return "Please fill Learning Objectives.";
  }
  if (!isValidCurriculumFramework(input.curriculumFramework)) {
    return "Invalid curriculum framework selection.";
  }
  return null;
}

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing DEEPSEEK_API_KEY in environment variables." },
      { status: 500 },
    );
  }

  let body: LessonPlanSectionRequestBody;
  try {
    body = (await req.json()) as LessonPlanSectionRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const section = body.section;
  if (typeof section !== "string" || !TEACHER_PACKAGE_SECTIONS.includes(section as TeacherPackageSectionKey)) {
    return NextResponse.json({ error: "Invalid or missing section." }, { status: 400 });
  }

  const input: LessonPlanInput = {
    curriculumType: body.curriculumType ?? "",
    curriculumFramework:
      typeof body.curriculumFramework === "string" ? body.curriculumFramework.trim() : "",
    grade: body.grade ?? "",
    subject: body.subject ?? "",
    chapter: typeof body.chapter === "string" ? body.chapter : "",
    topic: body.topic ?? "",
    learningObjectives: body.learningObjectives ?? "",
  };

  const rawSource =
    typeof body.sourceMaterial === "string" ? body.sourceMaterial.trim() : "";
  const sourceMaterial =
    rawSource.length > 0 ? rawSource.slice(0, SOURCE_MATERIAL_MAX_CHARS) : undefined;

  const validationError = validateInput(input);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const frameworkAddendum = buildCurriculumFrameworkSystemAddendum(input.curriculumFramework);

  try {
    const messages = buildMessagesForSingleSection(
      input,
      section as TeacherPackageSectionKey,
      sourceMaterial,
      frameworkAddendum,
    );
    const raw = await callDeepseekChat(apiKey, messages);
    const text = parseSingleSectionFromResponse(raw, section as TeacherPackageSectionKey);
    if (!text) {
      return NextResponse.json(
        { error: `Could not parse section "${section}" from model response.` },
        { status: 502 },
      );
    }

    let sectionImageUrls: string[] | undefined;
    let sectionImageError: string | undefined;
    try {
      const { url, error } = await generateFluxSectionImageForKey(
        input,
        section as TeacherPackageSectionKey,
        text,
      );
      if (url) {
        sectionImageUrls = [url];
      } else if (error) {
        sectionImageError = error;
      }
    } catch (e) {
      sectionImageError = formatFalError(e);
      console.error("[lesson-plan/section] FLUX failed:", sectionImageError, e);
    }

    return NextResponse.json({
      section,
      text,
      ...(sectionImageUrls ? { sectionImageUrls } : {}),
      ...(sectionImageError ? { sectionImageError } : {}),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[lesson-plan/section]", message, e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
