/**
 * LIVE sample harness (opt-in, calls DeepSeek; no database, no Gamma). Runs the real lesson route — real prompts,
 * parsing and key-word generation — with only the account checks mocked, then builds the five designed Word files.
 *
 *   DEEPSEEK_API_KEY=... DOCX_SAMPLE_DIR=<dir> npx vitest run src/lib/docx-samples-evidence.test.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const usage = { planType: "pro", generationsUsed: 0, generationsLimit: 100, canGenerate: true, remaining: 100 };
vi.mock("@/lib/user-usage-server", () => ({
  authenticateRequest: vi.fn(async () => ({ ok: true, supabase: {}, userId: "sample-user", accessToken: "t", email: "sample@layah.test" })),
  getCallerPlanType: vi.fn(async () => "pro"),
  getOrCreateUserUsage: vi.fn(async () => usage),
  reserveGeneration: vi.fn(async () => ({ ok: true, usage, reservation: null })),
  refundGeneration: vi.fn(async () => undefined),
}));
vi.mock("@/lib/generation-events", () => ({ logGenerationEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/ai-usage/deepseek", async (orig) => ({ ...(await orig<object>()), logDeepSeekUsage: vi.fn(async () => undefined) }));

import { POST } from "@/app/api/lesson-plan/route";
import { buildDocxBuffer } from "@/lib/lesson-plan-export";
import { LESSON_KEY_WORDS_KEY, parseKeyWords } from "@/lib/lesson-key-words";

const dir = process.env.DOCX_SAMPLE_DIR;
const DOCS = [
  { key: "Full Lesson Plan", title: "Lesson Plan", file: "1-lesson-plan", keyWords: true },
  { key: "Worksheet", title: "Worksheet", file: "2-worksheet", keyWords: true },
  { key: "Assessment Questions", title: "Assessment Questions", file: "3-assessment", keyWords: false },
  { key: "Homework Task", title: "Homework", file: "4-homework", keyWords: true },
  { key: "Teacher Notes", title: "Teacher Notes", file: "5-teacher-notes", keyWords: true },
] as const;

describe.skipIf(!process.env.DEEPSEEK_API_KEY || !dir)("LIVE: designed Word samples (Science Grade 6, Photosynthesis)", () => {
  it("generates the lesson and builds the five documents", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const chapter = "Chapter 7 — Getting to Know Plants (NCERT Science)";
    const res = await POST(new Request("http://x/api/lesson-plan", {
      method: "POST",
      headers: { "x-forwarded-for": "10.1.2.3" },
      body: JSON.stringify({
        topic: "Photosynthesis", subject: "Science", grade: "Grade 6", chapter, curriculumType: "CBSE/NCERT", language: "en",
        learningObjectives: "Describe how green plants make their own food.\nIdentify the raw materials and products of photosynthesis.",
        sections: DOCS.map((d) => d.key),
      }),
    }));
    expect(res.status).toBe(200);
    const { lessonPlan } = (await res.json()) as { lessonPlan: Record<string, string> };
    mkdirSync(dir!, { recursive: true });
    writeFileSync(join(dir!, "lesson.json"), JSON.stringify(lessonPlan, null, 2));
    const keyWords = parseKeyWords(lessonPlan[LESSON_KEY_WORDS_KEY]);
    for (const d of DOCS) {
      const buffer = await buildDocxBuffer({
        documentTitle: d.title, subject: "Science", grade: "Grade 6", topic: "Photosynthesis", chapter,
        content: lessonPlan[d.key] ?? "", ...(d.keyWords ? { keyWords } : {}),
      });
      writeFileSync(join(dir!, `${d.file}.docx`), buffer);
    }
    expect(keyWords.length).toBeGreaterThanOrEqual(6);
  }, 900_000);
});
