import { QP_BLUEPRINT_END, QP_BLUEPRINT_START } from "@/lib/question-paper-prompt";
import { stripOuterMarkdownFences } from "@/lib/parse-teacher-package-response";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BLUEPRINT_START_ALIASES = [
  QP_BLUEPRINT_START,
  "BLUEPRINT JSON START",
  "BLUEPRINT START",
] as const;

const BLUEPRINT_END_ALIASES = [QP_BLUEPRINT_END, "BLUEPRINT JSON END", "BLUEPRINT END"] as const;

function extractBetweenMarkers(raw: string, startMarkers: readonly string[], endMarkers: readonly string[]): string {
  for (const start of startMarkers) {
    for (const end of endMarkers) {
      const sEsc = escapeRe(start);
      const eEsc = escapeRe(end);
      const re = new RegExp(
        `(?:^|[\\r\\n])\\s*\\*{0,2}\\s*${sEsc}\\s*\\*{0,2}\\s*(?::)?\\s*[\\r\\n]+([\\s\\S]*?)(?:[\\r\\n]+\\s*\\*{0,2}\\s*${eEsc}\\s*\\*{0,2})`,
        "im",
      );
      const m = raw.match(re);
      if (m?.[1]?.trim()) return m[1].trim();
    }
  }
  return "";
}

export function parseBlueprintPlainTextResponse(raw: string): {
  blueprintText?: string;
  error?: string;
} {
  const trimmed = stripOuterMarkdownFences(raw?.trim() ?? "");
  let text = extractBetweenMarkers(trimmed, BLUEPRINT_START_ALIASES, BLUEPRINT_END_ALIASES);

  if (!text) {
    if (/TABLE\s*1|Bloom|BLUEPRINT\s+SUMMARY/i.test(trimmed)) {
      text = trimmed;
    }
  }

  if (!text.trim()) {
    return { error: `${QP_BLUEPRINT_START} / ${QP_BLUEPRINT_END} block not found in blueprint response.` };
  }

  return { blueprintText: text.trim() };
}
