import {
  BLOOMS_LEVELS,
  formatBlueprintPreviewMarkdown,
  type BlueprintBloomsLevel,
  type QuestionPaperBlueprint,
} from "@/lib/question-paper-blueprint";
import { QP_BLUEPRINT_END, QP_BLUEPRINT_START } from "@/lib/question-paper-prompt";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBlueprintJson(raw: string): string {
  const sEsc = escapeRe(QP_BLUEPRINT_START);
  const eEsc = escapeRe(QP_BLUEPRINT_END);
  const re = new RegExp(
    `(?:^|[\\r\\n])\\s*\\*{0,2}\\s*${sEsc}\\s*\\*{0,2}\\s*(?::)?\\s*[\\r\\n]+([\\s\\S]*?)(?:[\\r\\n]+\\s*\\*{0,2}\\s*${eEsc})`,
    "im",
  );
  const m = raw.match(re);
  let inner = m?.[1]?.trim() ?? "";
  if (!inner) return "";
  inner = inner.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const jsonStart = inner.indexOf("{");
  const jsonEnd = inner.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    return inner.slice(jsonStart, jsonEnd + 1);
  }
  return inner;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function normalizeBloomsLevel(v: string): BlueprintBloomsLevel {
  const t = v.trim();
  const hit = BLOOMS_LEVELS.find((l) => l.toLowerCase() === t.toLowerCase());
  return hit ?? "Understand";
}

export function parseQuestionPaperBlueprint(
  raw: string,
): { blueprint?: QuestionPaperBlueprint; markdown?: string; error?: string } {
  const jsonText = extractBlueprintJson(raw);
  if (!jsonText) {
    return { error: "Blueprint JSON block not found in response." };
  }

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const chapterWise = Array.isArray(parsed.chapterWise)
      ? parsed.chapterWise.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            chapter: str(r.chapter, "General"),
            questions: num(r.questions),
            marks: num(r.marks),
            percent: num(r.percent),
          };
        })
      : [];

    const bloomsTaxonomy = Array.isArray(parsed.bloomsTaxonomy)
      ? parsed.bloomsTaxonomy.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            level: normalizeBloomsLevel(str(r.level, "Understand")),
            questions: num(r.questions),
            marks: num(r.marks),
            percent: num(r.percent),
          };
        })
      : BLOOMS_LEVELS.map((level) => ({
          level,
          questions: 0,
          marks: 0,
          percent: 0,
        }));

    const questionTypes = Array.isArray(parsed.questionTypes)
      ? parsed.questionTypes.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            type: str(r.type, "Other"),
            questions: num(r.questions),
            marksPerQuestion: num(r.marksPerQuestion),
            totalMarks: num(r.totalMarks),
          };
        })
      : [];

    const difficulty = Array.isArray(parsed.difficulty)
      ? parsed.difficulty.map((row) => {
          const r = row as Record<string, unknown>;
          const level = str(r.level, "Medium");
          return {
            level: (["Easy", "Medium", "Hard"].includes(level) ? level : "Medium") as
              | "Easy"
              | "Medium"
              | "Hard",
            questions: num(r.questions),
            marks: num(r.marks),
          };
        })
      : [
          { level: "Easy" as const, questions: 0, marks: 0 },
          { level: "Medium" as const, questions: 0, marks: 0 },
          { level: "Hard" as const, questions: 0, marks: 0 },
        ];

    const summaryRaw = (parsed.summary ?? {}) as Record<string, unknown>;
    const blueprint: QuestionPaperBlueprint = {
      chapterWise,
      bloomsTaxonomy,
      questionTypes,
      difficulty,
      summary: {
        totalQuestions: num(summaryRaw.totalQuestions),
        totalMarks: num(summaryRaw.totalMarks),
        estimatedCompletionTime: str(summaryRaw.estimatedCompletionTime, "—"),
        syllabusCoveragePercent: num(summaryRaw.syllabusCoveragePercent),
      },
    };

    return {
      blueprint,
      markdown: formatBlueprintPreviewMarkdown(blueprint),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Invalid blueprint JSON: ${msg}` };
  }
}
