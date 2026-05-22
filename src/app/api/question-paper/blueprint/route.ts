import { NextResponse } from "next/server";
import { callDeepSeekChat } from "@/lib/question-paper-deepseek";
import { parseBlueprintPlainTextResponse } from "@/lib/parse-question-paper-blueprint";
import {
  buildBlueprintSystemPrompt,
  buildBlueprintUserMessage,
} from "@/lib/question-paper-prompt";
import {
  isValidDifficulty,
  isValidTimeAllowed,
  type QuestionPaperDifficulty,
  type QuestionPaperTimeOption,
} from "@/lib/question-paper";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEEPSEEK_MAX_TOKENS_BLUEPRINT = 4000;

type BlueprintBody = {
  subject?: string;
  grade?: string;
  topic?: string;
  curriculumType?: string;
  totalMarks?: number;
  timeAllowed?: string;
  difficulty?: string;
  questionPaper?: string;
  answerKey?: string;
};

export async function POST(req: Request) {
  let body: BlueprintBody;
  try {
    body = (await req.json()) as BlueprintBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const grade = body.grade?.trim();
  const topic = body.topic?.trim();
  const questionPaper = body.questionPaper?.trim();
  const totalMarks = Number(body.totalMarks);

  if (!subject || !grade || !topic || !questionPaper) {
    return NextResponse.json(
      { error: "subject, grade, topic, and questionPaper are required." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(totalMarks) || totalMarks < 1) {
    return NextResponse.json({ error: "totalMarks must be a positive number." }, { status: 400 });
  }

  const timeRaw = body.timeAllowed?.trim() ?? "1 hour";
  const diffRaw = body.difficulty?.trim() ?? "Medium";
  const timeAllowed: QuestionPaperTimeOption = isValidTimeAllowed(timeRaw) ? timeRaw : "1 hour";
  const difficulty: QuestionPaperDifficulty = isValidDifficulty(diffRaw) ? diffRaw : "Medium";

  const ds = await callDeepSeekChat({
    logLabel: "question-paper-call-2-blueprint",
    systemPrompt: buildBlueprintSystemPrompt(),
    userMessage: buildBlueprintUserMessage({
      subject,
      grade,
      topic,
      curriculumType: body.curriculumType?.trim() ?? "",
      totalMarks,
      timeAllowed,
      difficulty,
      questionPaper,
      answerKey: body.answerKey,
    }),
    maxTokens: DEEPSEEK_MAX_TOKENS_BLUEPRINT,
    temperature: 0.4,
  });

  if ("error" in ds) {
    return NextResponse.json({ error: ds.error, blueprintError: ds.error }, { status: 502 });
  }

  const parsed = parseBlueprintPlainTextResponse(ds.content);
  if (!parsed.blueprintText) {
    return NextResponse.json(
      {
        error: parsed.error ?? "Blueprint could not be parsed.",
        blueprintError: parsed.error,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    blueprintText: parsed.blueprintText,
  });
}
