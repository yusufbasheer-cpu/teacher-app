import {
  QP_ANSWER_KEY_END,
  QP_ANSWER_KEY_START,
  QP_MARKING_SCHEME_END,
  QP_MARKING_SCHEME_START,
  QP_PAPER_END,
  QP_PAPER_START,
} from "@/lib/question-paper-prompt";
import type { QuestionPaperResult } from "@/lib/question-paper";
import { parseQuestionPaperBlueprint } from "@/lib/parse-question-paper-blueprint";
import { stripOuterMarkdownFences } from "@/lib/parse-teacher-package-response";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBetween(raw: string, start: string, end: string): string {
  const sEsc = escapeRe(start);
  const eEsc = escapeRe(end);
  const re = new RegExp(
    `(?:^|[\\r\\n])\\s*\\*{0,2}\\s*${sEsc}\\s*\\*{0,2}\\s*(?::)?\\s*[\\r\\n]+([\\s\\S]*?)(?:[\\r\\n]+\\s*\\*{0,2}\\s*${eEsc}\\s*\\*{0,2})`,
    "im",
  );
  const m = raw.match(re);
  return m?.[1]?.trim() ?? "";
}

export function parseQuestionPaperResponse(
  raw: string,
  options?: { expectBlueprint?: boolean },
): QuestionPaperResult {
  const trimmed = stripOuterMarkdownFences(raw?.trim() ?? "");
  const notices: string[] = [];

  let questionPaper = extractBetween(trimmed, QP_PAPER_START, QP_PAPER_END);
  const answerKey = extractBetween(trimmed, QP_ANSWER_KEY_START, QP_ANSWER_KEY_END);
  const markingScheme = extractBetween(trimmed, QP_MARKING_SCHEME_START, QP_MARKING_SCHEME_END);

  if (!questionPaper) {
    const alt = trimmed
      .replace(
        new RegExp(`[\\s\\S]*?${escapeRe(QP_ANSWER_KEY_START)}`, "i"),
        "",
      )
      .replace(new RegExp(`${escapeRe(QP_MARKING_SCHEME_START)}[\\s\\S]*`, "i"), "")
      .trim();
    questionPaper = alt.length > 80 ? alt : trimmed;
    notices.push("QUESTION PAPER markers missing — used full response as paper body.");
  }

  if (!questionPaper.trim()) {
    questionPaper = "(No question paper content was returned.)";
    notices.push("empty question paper");
  }

  let blueprint: QuestionPaperResult["blueprint"];
  let blueprintMarkdown: string | undefined;
  if (options?.expectBlueprint) {
    const bp = parseQuestionPaperBlueprint(trimmed);
    if (bp.blueprint) {
      blueprint = bp.blueprint;
      blueprintMarkdown = bp.markdown;
    } else if (bp.error) {
      notices.push(bp.error);
    }
  }

  return {
    questionPaper,
    ...(answerKey ? { answerKey } : {}),
    ...(markingScheme ? { markingScheme } : {}),
    ...(blueprint ? { blueprint, blueprintMarkdown } : {}),
    ...(notices.length ? { parseNotice: notices.join(" ") } : {}),
  };
}
