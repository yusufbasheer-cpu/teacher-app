import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";

export type PptContentSafetyWarning = {
  slideIndex: number;
  slideNumber1Based: number;
  slideTitle: string;
  kind: "suspicious-equation" | "incomplete-sentence" | "truncated-content";
  message: string;
};

const OPERATOR_GAP_RE =
  /\b(?:-?\d+(?:\.\d+)?[a-zA-Z]?|[a-zA-Z]\d*)\s+(?:_{2,}|-{2,}|\.{3,}|\[\s*\]|\(\s*\))\s+(?:-?\d+(?:\.\d+)?[a-zA-Z]?|[a-zA-Z]\d*)\b/;

const TRAILING_OK_RE = /[.!?؟。]|["')\]]$/;
const LABEL_OR_EQUATION_RE = /[:=+\-*/×÷<>≤≥]|\b(?:task|activity|question|step|challenge|output)\b/i;

export function hasSuspiciousEquationOperatorGap(text: string): boolean {
  return OPERATOR_GAP_RE.test(text);
}

export function hasIncompleteTrailingSentence(text: string): boolean {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  const last = lines[lines.length - 1]!;
  if (last.length < 24) return false;
  if (TRAILING_OK_RE.test(last)) return false;
  if (LABEL_OR_EQUATION_RE.test(last)) return false;
  return /\b(?:and|or|the|a|an|of|to|with|from|by|for|in|on|at|as|that|which|because)$/i.test(last) ||
    /[a-zA-Z][a-zA-Z]{3,}$/.test(last);
}

export function validatePptContentSafety(
  slides: readonly StructuredLessonSlideModel[],
): PptContentSafetyWarning[] {
  const warnings: PptContentSafetyWarning[] = [];
  slides.forEach((slide, idx) => {
    const body = slide.body ?? "";
    const base = {
      slideIndex: idx,
      slideNumber1Based: idx + 1,
      slideTitle: slide.slideTitle,
    };
    if (hasSuspiciousEquationOperatorGap(body)) {
      warnings.push({
        ...base,
        kind: "suspicious-equation",
        message: "Possible missing mathematical operator or unintended blank inside an equation.",
      });
    }
    if (body.includes("…")) {
      warnings.push({
        ...base,
        kind: "truncated-content",
        message: "Slide body contains an ellipsis inserted by truncation; check for lost lesson content.",
      });
    }
    if (hasIncompleteTrailingSentence(body)) {
      warnings.push({
        ...base,
        kind: "incomplete-sentence",
        message: "Slide body appears to end mid-sentence.",
      });
    }
  });
  return warnings;
}
