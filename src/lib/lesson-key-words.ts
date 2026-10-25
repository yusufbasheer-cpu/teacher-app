import { logDeepSeekUsage } from "@/lib/ai-usage/deepseek";
import type { KeyWord } from "@/lib/docx-design";

/**
 * The lesson's key words: 6–10 words that are actually taught or used in THIS lesson, each with a short
 * student-friendly meaning and where it is used. Generated once from the finished lesson text and stored on the
 * lesson (a "__" key, so it is never shown as a section), so the lesson plan, worksheet, homework and teacher's
 * notes all show the same list.
 */
export const LESSON_KEY_WORDS_KEY = "__keyWords";

const MIN_WORDS = 6;
const MAX_WORDS = 10;

export function parseKeyWords(raw: unknown): KeyWord[] {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const r = item as Record<string, unknown>;
      const word = String(r.word ?? r.keyword ?? "").trim().slice(0, 60);
      const meaning = String(r.meaning ?? r.simple_meaning ?? "").trim().slice(0, 200);
      const usedIn = String(r.usedIn ?? r.used_in ?? "").trim().slice(0, 80);
      return word && meaning ? { word, meaning, ...(usedIn ? { usedIn } : {}) } : null;
    })
    .filter((w): w is KeyWord => w !== null)
    .slice(0, MAX_WORDS);
}

/** A key word counts as used when it (or its singular/plural form) appears in the lesson text. */
export function keyWordAppears(word: string, lessonText: string): boolean {
  const text = lessonText.toLowerCase();
  const w = word.toLowerCase().trim();
  const forms = new Set([w, w.replace(/(es|s)$/, ""), `${w}s`, `${w}es`]);
  return [...forms].some((f) => f.length >= 3 && new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text));
}

export async function generateLessonKeyWords(params: {
  apiKey: string;
  subject: string;
  grade: string;
  topic: string;
  chapter?: string;
  lessonText: string;
  usageUserId?: string;
}): Promise<KeyWord[]> {
  const startedAt = Date.now();
  const lessonText = params.lessonText.replace(/<!--[\s\S]*?-->/g, "").slice(0, 14_000);
  const body = {
    model: "deepseek-chat",
    temperature: 0.2,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content: "You pick key vocabulary for a school lesson. Reply only as JSON {\"key_words\": [{\"word\": \"...\", \"meaning\": \"...\", \"used_in\": \"...\"}]} with no markdown fences.",
      },
      {
        role: "user",
        content: `Lesson: ${params.grade} ${params.subject} — ${params.topic}${params.chapter ? ` (${params.chapter})` : ""}.

Choose ${MIN_WORDS} to ${MAX_WORDS} key words from the chapter and topic of THIS lesson. Only words that are actually taught or used in the lesson text below — no extra words.
For each: "word" exactly as written in the lesson; "meaning" in one short, student-friendly line (at most 15 words) for a ${params.grade} student; "used_in" naming the part of the lesson where it is used (for example "Starter", "Main phase", "Plenary", "Worksheet").

Lesson text:
${lessonText}`,
      },
    ],
  };
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${params.apiKey}` },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    if (params.usageUserId) void logDeepSeekUsage({ userId: params.usageUserId, operation: "lesson_key_words", requestedModel: "deepseek-chat", rawBody: raw, status: res.ok ? "success" : "failed", durationMs: Date.now() - startedAt });
    if (!res.ok) return [];
    const content = (JSON.parse(raw) as { choices?: [{ message?: { content?: string } }] }).choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")) as { key_words?: unknown };
    const words = parseKeyWords(parsed.key_words).filter((w) => keyWordAppears(w.word, params.lessonText));
    const unique = words.filter((w, i) => words.findIndex((o) => o.word.toLowerCase() === w.word.toLowerCase()) === i);
    return unique.length >= 3 ? unique.slice(0, MAX_WORDS) : [];
  } catch (error) {
    console.warn("[lesson-key-words] generation failed:", error instanceof Error ? error.message : error);
    return [];
  }
}
