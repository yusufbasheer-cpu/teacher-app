/**
 * LIVE evidence harness (opt-in, calls DeepSeek; never calls Gamma). Generates a real 13-element lesson the way the
 * lesson route does (two waves, then the post-generation guards), builds the exact Gamma input and the built-in PPTX,
 * and writes the checks to LIVE_DECK_DIR/evidence.json.
 *
 *   DEEPSEEK_API_KEY=... LIVE_DECK_DIR=<dir> npx vitest run src/lib/ppt-live-deck-evidence.test.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateSlide1Body, generateSlide2, generateSlide3, generateSlide4Body, generateSlide5, generateSlide6, generateSlide7,
  generateSlide8, generateSlide9, generateSlide10, generateSlide11, generateSlide12, generateSlide13Body,
  type SlideGenParams, type SlideGenResult,
} from "@/lib/ppt-individual-slide-generator";
import { finishGeneratedDeck, sameWatchFor } from "@/lib/ppt-post-generation";
import { formatAflForSinglePptSlidePrompt, resolveMainPhaseActivity } from "@/lib/afl-tools";
import { parseSelectedSdg, type TeachingEvidence } from "@/lib/ppt-educational-quality";
import { OFFICIAL_SDG_NAMES, countWords, teacherKeywordsIn } from "@/lib/ppt-slide-guards";
import { assembleFullPptFromSlideBodies } from "@/lib/ppt-slide-by-slide";
import { buildStructuredLessonSlides, getStructuredLessonSlideTitles } from "@/lib/ppt-structured-lesson";
import { buildGammaPayload } from "@/lib/gamma/payload";
import { duplicateNoteLines } from "@/lib/ppt-speaker-notes";
import { buildPptxFromPptContent } from "@/lib/lesson-plan-export";
import { testConfig } from "@/lib/gamma/test-helpers";

const LESSON = {
  subject: "Science",
  grade: "Grade 6",
  topic: "Photosynthesis",
  chapter: "Chapter 7 — Getting to Know Plants (NCERT Science)",
  learningObjectives: "Describe how green plants make their own food.\nIdentify the raw materials and products of photosynthesis.",
  curriculumFramework: "UAE Framework - UAE MOE, KHDA and SPEA Standards",
};

const dir = process.env.LIVE_DECK_DIR;
describe.skipIf(!process.env.DEEPSEEK_API_KEY || !dir)("LIVE: Photosynthesis deck evidence", () => {
  it("generates, guards and reports", async () => {
    const ctx = { subject: LESSON.subject, grade: LESSON.grade, topic: LESSON.topic, learningObjectives: LESSON.learningObjectives };
    const block = (slide: number) => formatAflForSinglePptSlidePrompt(slide, {}, ctx);
    const params: SlideGenParams = {
      topic: LESSON.topic, subject: LESSON.subject, grade: LESSON.grade, chapter: LESSON.chapter, curriculumType: "CBSE",
      learningObjectives: LESSON.learningObjectives,
      starterAflBlock: block(2), mainAflBlock: block(6), plenaryAflBlock: block(9), differentiationAflBlock: block(7),
      exitTicketAflBlock: block(11), successCriteriaAflBlock: block(12),
      mainActivity: resolveMainPhaseActivity({}, ctx), aflSelections: {}, language: "en", uaeFrameworkEnabled: true,
      dateStr: "Monday, 26 October 2026",
    };
    const wave1 = await Promise.all([
      Promise.resolve(generateSlide1Body(params)), generateSlide2(params), generateSlide3(params), Promise.resolve(generateSlide4Body(params)),
      generateSlide5(params), generateSlide6(params), generateSlide10(params), generateSlide12(params), Promise.resolve(generateSlide13Body(params)),
    ]);
    const [r1, r2, r3, r4, r5, r6, r10, r12, r13] = wave1;
    const teachingEvidence: TeachingEvidence[] = [
      { elementId: "starter", slideNumber: 2, title: "Starter Activity", content: r2.body },
      { elementId: "main-phase", slideNumber: 6, title: "Main Phase Core Teaching", content: [r6.body, ...(r6.mainPhaseActivities ?? []).map((a) => a.activityContent)].join("\n\n") },
    ];
    const parsed = parseSelectedSdg(undefined, r3.body);
    const selectedSdg = parsed && OFFICIAL_SDG_NAMES[parsed.id] ? { ...parsed, name: OFFICIAL_SDG_NAMES[parsed.id]! } : parsed;
    const q = { ...params, teachingEvidence, ...(selectedSdg ? { selectedSdg } : {}) };
    const [r7, r8, r9, r11] = await Promise.all([generateSlide7(q), generateSlide8(q), generateSlide9(q), generateSlide11(q)]);
    const bodies: SlideGenResult[] = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13];
    const rawWords = bodies.map((b) => countWords(b.body));

    const titles = getStructuredLessonSlideTitles(false, true);
    const post = await finishGeneratedDeck(bodies, { titles, language: "en", topic: LESSON.topic, uae: true });

    const outline = assembleFullPptFromSlideBodies(bodies.map((b) => b.body), false, true, bodies.map((b) => b.teacherNotes), r6.mainPhaseActivities ?? []);
    const deck = buildStructuredLessonSlides({
      subject: LESSON.subject, grade: LESSON.grade, topic: LESSON.topic, chapter: LESSON.chapter, teacherName: "Ms Test",
      learningObjectivesText: LESSON.learningObjectives, pptContent: outline, curriculumFramework: LESSON.curriculumFramework, language: "en",
    });
    const lesson = { topic: LESSON.topic, subject: LESSON.subject, grade: LESSON.grade, chapter: LESSON.chapter };
    const payload = buildGammaPayload({ deck, title: `${LESSON.grade} ${LESSON.subject}: ${LESSON.topic}`, language: "en", config: testConfig(), lesson });
    const legacy = await buildPptxFromPptContent({ subject: LESSON.subject, grade: LESSON.grade, topic: LESSON.topic, pptContent: outline, structuredSlides: deck, language: "en" });

    const physical = payload.slides.map((s, i) => ({
      slide: i + 1, element: s.deckIdx + 1, part: `${s.part}/${s.parts}`, title: s.title,
      words: countWords([s.title, ...s.lines].join(" ")), teacherKeywords: teacherKeywordsIn(s.lines.join("\n")),
      sdg: s.lines.filter((l) => /\bSDG\b|Sustainable Development Goal/i.test(l)),
    }));
    const evidence = {
      lesson: LESSON,
      perElementWords: titles.map((t, i) => ({ element: i + 1, title: t, raw: rawWords[i], afterGuards: post.words[i]!.after, limit: post.words[i]!.limit ?? null, shortened: post.words[i]!.shortened, note: post.words[i]!.note })),
      physicalSlides: physical,
      uaeSlideText: payload.slides.filter((s) => s.deckIdx === 7).map((s) => s.lines.join("\n")),
      teacherTextOnSlides: physical.filter((p) => p.teacherKeywords.length),
      removedBeforeGamma: payload.removedTeacherLines,
      sdgPerSlide: physical.filter((p) => p.sdg.length).map((p) => ({ slide: p.slide, sdg: p.sdg })),
      deckSdg: post.sdg,
      notes: payload.notes.map((n, i) => ({ slide: i + 1, notes: n })),
      duplicateNotes: duplicateNoteLines(payload.notes),
      paraphrasedWatchFor: (() => {
        const watch = payload.notes.map((n, i) => ({ slide: i + 1, text: n.split("\n").find((l) => /^Watch for:/.test(l))?.slice(11) })).filter((w): w is { slide: number; text: string } => !!w.text);
        return watch.flatMap((a, i) => watch.slice(i + 1).filter((b) => sameWatchFor(a.text, b.text)).map((b) => [a.slide, b.slide]));
      })(),
      repeatedNotesRegenerated: post.repeatedNotes,
    };
    mkdirSync(dir!, { recursive: true });
    writeFileSync(join(dir!, "evidence.json"), JSON.stringify(evidence, null, 2));
    writeFileSync(join(dir!, "gamma-inputText.md"), String(payload.request.inputText));
    writeFileSync(join(dir!, "photosynthesis-builtin.pptx"), legacy);

    expect(evidence.teacherTextOnSlides).toEqual([]);
    expect(evidence.duplicateNotes).toEqual([]);
  }, 600_000);
});
