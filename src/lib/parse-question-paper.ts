import {
  QP_ANSWER_KEY_END,
  QP_ANSWER_KEY_START,
  QP_MARKING_SCHEME_END,
  QP_MARKING_SCHEME_START,
  QP_PAPER_END,
  QP_PAPER_START,
  QP_PAPER_START_ALIASES,
} from "@/lib/question-paper-prompt";
import type { QuestionPaperResult } from "@/lib/question-paper";
import { stripOuterMarkdownFences } from "@/lib/parse-teacher-package-response";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBetweenMarkers(raw: string, startMarkers: readonly string[], endMarker: string): string {
  for (const start of startMarkers) {
    const sEsc = escapeRe(start);
    const eEsc = escapeRe(endMarker);
    const re = new RegExp(
      `(?:^|[\\r\\n])\\s*\\*{0,2}\\s*${sEsc}\\s*\\*{0,2}\\s*(?::)?\\s*[\\r\\n]+([\\s\\S]*?)(?:[\\r\\n]+\\s*\\*{0,2}\\s*${eEsc}\\s*\\*{0,2})`,
      "im",
    );
    const m = raw.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

export function parseQuestionPaperResponse(raw: string): QuestionPaperResult {
  const trimmed = stripOuterMarkdownFences(raw?.trim() ?? "");
  const notices: string[] = [];

  let questionPaper = extractBetweenMarkers(trimmed, QP_PAPER_START_ALIASES, QP_PAPER_END);
  const answerKey = extractBetweenMarkers(trimmed, [QP_ANSWER_KEY_START], QP_ANSWER_KEY_END);
  const markingScheme = extractBetweenMarkers(trimmed, [QP_MARKING_SCHEME_START], QP_MARKING_SCHEME_END);

  if (!questionPaper) {
    const alt = trimmed
      .replace(new RegExp(`[\\s\\S]*?${escapeRe(QP_ANSWER_KEY_START)}`, "i"), "")
      .replace(new RegExp(`${escapeRe(QP_MARKING_SCHEME_START)}[\\s\\S]*`, "i"), "")
      .trim();
    questionPaper = alt.length > 80 ? alt : trimmed;
    notices.push(
      `${QP_PAPER_START} / ${QP_PAPER_END} markers missing — used full response as paper body.`,
    );
  }

  if (!questionPaper.trim()) {
    questionPaper = "(No question paper content was returned.)";
    notices.push("empty question paper");
  }

  return {
    questionPaper,
    ...(answerKey ? { answerKey } : {}),
    ...(markingScheme ? { markingScheme } : {}),
    ...(notices.length ? { parseNotice: notices.join(" ") } : {}),
  };
}
