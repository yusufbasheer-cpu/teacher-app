/**
 * The five educational-quality requirements, checked on FINAL PPTX files (text and notes read back from the archive)
 * for both renderers, using the offline Grade 6 Photosynthesis fixture. No provider is called.
 *
 *   PHOTOSYNTHESIS_EVIDENCE_DIR=<dir> npx vitest run src/lib/ppt-educational-quality.test.ts
 * also writes both decks and evidence.json to <dir>.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PHOTOSYNTHESIS_ACTIVITIES,
  PHOTOSYNTHESIS_BODIES,
  PHOTOSYNTHESIS_DECK_QUALITY,
  PHOTOSYNTHESIS_LESSON as L,
  PHOTOSYNTHESIS_TEACHER_NOTES,
} from "@/lib/__fixtures__/photosynthesis-grade6";
import { assembleFullPptFromSlideBodies, parseTeacherNotesFromPptOutline } from "@/lib/ppt-slide-by-slide";
import { buildStructuredLessonSlides } from "@/lib/ppt-structured-lesson";
import { buildPptxFromTemplateEngine } from "@/lib/ppt-template-engine";
import {
  collectSdgReferences,
  isComplianceClaim,
  resolveQuestionMappingsToPhysicalSlides,
  scanStudentFacingText,
  validateSelectedSdg,
} from "@/lib/ppt-educational-quality";
import { buildGammaPayload } from "@/lib/gamma/payload";
import { insertSpeakerNotes, readSpeakerNotes } from "@/lib/gamma/notes";
import { compareToSnapshot, extractPptx, type ExtractedDeck } from "@/lib/gamma/validate";
import { pptxFrom, testConfig } from "@/lib/gamma/test-helpers";

const outline = assembleFullPptFromSlideBodies(
  PHOTOSYNTHESIS_BODIES, false, true, PHOTOSYNTHESIS_TEACHER_NOTES, PHOTOSYNTHESIS_ACTIVITIES, PHOTOSYNTHESIS_DECK_QUALITY,
);
const deck = buildStructuredLessonSlides({
  subject: L.subject, grade: L.grade, topic: L.topic, chapter: L.chapter, teacherName: "Ms Test",
  learningObjectivesText: L.learningObjectives, pptContent: outline, curriculumFramework: L.curriculumFramework, language: "en",
});
const lesson = { topic: L.topic, subject: L.subject, grade: L.grade, chapter: L.chapter };
const payload = buildGammaPayload({ deck, title: `${L.grade} ${L.subject}: ${L.topic}`, language: "en", config: testConfig(), lesson });

const slideTexts = (d: ExtractedDeck) => d.slides.map((s, i) => ({ slideTitle: `Slide ${i + 1}`, body: s.paragraphs.map((p) => p.text).join("\n") }));

async function finalDecks() {
  const legacy = await buildPptxFromTemplateEngine({ templateId: "classic", slides: deck, subject: L.subject, grade: L.grade, topic: L.topic });
  // A Gamma export carries the canonical text and empty notes slides; Layah then writes the notes into it.
  const gamma = await insertSpeakerNotes(await pptxFrom(payload.snapshot.map((s) => s.lines)), payload.notes);
  return { legacy, gamma };
}

describe("Photosynthesis (Grade 6): the five fixes hold in the final PPTX", () => {
  it("keeps the 13 logical elements and lets overflow decide the physical slides", async () => {
    expect(deck).toHaveLength(13);
    expect(deck.map((m) => m.educationalMetadata?.elementId)).toEqual([
      "title", "starter", "topic-sdg", "objectives", "outcomes", "main-phase", "differentiation",
      "uae-connection", "plenary", "extended-task", "exit-ticket", "self-evaluation", "takeaway",
    ]);
    const { legacy, gamma } = await finalDecks();
    const legacyDeck = await extractPptx(legacy);
    expect(legacyDeck.slides.length).toBe(payload.slides.length);
    expect((await extractPptx(gamma)).slides.length).toBe(payload.slides.length);
    // The activity has its own instruction slide right before its content.
    const instructions = payload.slides.findIndex((s) => s.physicalKind === "activity-instructions");
    expect(payload.slides[instructions]!.title).toBe("How to do: Jigsaw: Photosynthesis Experts");
    expect(payload.slides[instructions + 1]!.activityId).toBe("jigsaw-photosynthesis");
  });

  it("FIX 1: every question is traced to an earlier teaching slide, and its answer is in that slide's notes", async () => {
    const mappings = resolveQuestionMappingsToPhysicalSlides(deck, payload.slides);
    expect(mappings).toHaveLength(6);
    for (const m of mappings) {
      expect(m.result, `${m.questionId}: ${m.reason ?? ""}`).toBe("passed");
      expect(Math.max(...m.sourcePhysicalSlides)).toBeLessThan(m.questionPhysicalSlide);
    }
    const { gamma, legacy } = await finalDecks();
    for (const notes of [await readSpeakerNotes(gamma), await readSpeakerNotes(legacy)]) {
      for (const m of mappings) {
        const onSlide = notes[m.questionPhysicalSlide - 1]!;
        expect(onSlide, `${m.questionId} answer on slide ${m.questionPhysicalSlide}`).toContain(m.expectedAnswer.slice(0, 20));
      }
    }
    // Expected answers never appear on the student slides, and the fill-in blanks survive in both decks.
    const studentText = slideTexts(await extractPptx(gamma)).map((s) => s.body).join("\n");
    expect(studentText).not.toContain("Light energy, water and carbon dioxide.");
    for (const file of [gamma, legacy]) {
      const text = slideTexts(await extractPptx(file)).map((s) => s.body).join("\n");
      expect(text).toContain("A plant needs ______, ______ and ______ to make food.");
      expect(text).toContain("carbon dioxide + ______ → glucose + ______");
    }
  });

  it("FIX 2: no compliance or teacher-administrative text on student slides; the claim moved to the notes", async () => {
    const { legacy, gamma } = await finalDecks();
    for (const file of [legacy, gamma]) {
      expect(scanStudentFacingText(slideTexts(await extractPptx(file)))).toEqual([]);
    }
    const uaeSlide = payload.slides.findIndex((s) => s.deckIdx === 7);
    expect((await readSpeakerNotes(gamma))[uaeSlide]).toContain("KHDA inspection standards");
    // Legitimate UAE teaching content stays on the slide.
    expect(slideTexts(await extractPptx(gamma))[uaeSlide]!.body).toContain("Ghaf tree");
    expect(isComplianceClaim("The Ministry of Education runs a national science fair.")).toBe(false);
  });

  it("FIX 3: exactly one SDG across every explicit reference", async () => {
    const { legacy, gamma } = await finalDecks();
    for (const file of [legacy, gamma]) {
      const texts = slideTexts(await extractPptx(file));
      const refs = collectSdgReferences(texts);
      expect(refs.length).toBeGreaterThanOrEqual(2);
      expect(new Set(refs.map((r) => r.id))).toEqual(new Set([2]));
      expect(validateSelectedSdg(texts, PHOTOSYNTHESIS_DECK_QUALITY.selectedSdg!)).toEqual([]);
    }
    expect(validateSelectedSdg([{ body: "SDG 13 — Climate Action" }], PHOTOSYNTHESIS_DECK_QUALITY.selectedSdg!)).toHaveLength(1);
  });

  it("FIX 4: the differentiation slide shows Must / Should / Could and no ability-group label", async () => {
    const { legacy, gamma } = await finalDecks();
    for (const file of [legacy, gamma]) {
      const texts = slideTexts(await extractPptx(file));
      const diff = texts.filter((_, i) => payload.slides[i]!.deckIdx === 6).map((s) => s.body).join("\n");
      const labels = diff.split("\n").map((l) => l.trim()).filter((l) => /^(Must|Should|Could)$/.test(l));
      expect(labels).toEqual(["Must", "Should", "Could"]);
      expect(diff).not.toMatch(/Achiever|Ability|weak students|strong students/i);
      // The tasks kept their difficulty: Must is the scaffolded sentence, Could the prediction.
      expect(diff.indexOf("Complete the sentence")).toBeLessThan(diff.indexOf("Predict what would happen"));
    }
  });

  it("FIX 5: every physical slide has 3–6 useful note lines in the actual notes parts", async () => {
    const { legacy, gamma } = await finalDecks();
    for (const file of [legacy, gamma]) {
      const notes = await readSpeakerNotes(file);
      expect(notes).toHaveLength(payload.slides.length);
      notes.forEach((n, i) => {
        const lines = n.split("\n").filter(Boolean);
        expect(lines.length, `slide ${i + 1}`).toBeGreaterThanOrEqual(3);
        expect(lines.length, `slide ${i + 1}`).toBeLessThanOrEqual(6);
        expect(n, `slide ${i + 1}`).toMatch(/^Timing: about \d+ min/);
      });
    }
    // Continuation slides get their own notes, not a copy of part 1.
    const notes = await readSpeakerNotes(gamma);
    payload.slides.forEach((s, i) => {
      if (s.part > 1) expect(notes[i]).not.toBe(notes[i - 1]);
    });
  });

  it("keeps the generated teacher notes when the deck-quality trailer is present (any trailer order)", () => {
    // Regression: the notes parser used to read to the end of the text, so any trailer after it erased every note.
    expect(deck[5]!.speakerNotes).toContain("Model the word equation on the board");
    const notesOnly = assembleFullPptFromSlideBodies(PHOTOSYNTHESIS_BODIES, false, true, PHOTOSYNTHESIS_TEACHER_NOTES);
    expect(parseTeacherNotesFromPptOutline(notesOnly)[5]).toContain("Model the word equation");
    const notesThenOther = `${notesOnly}\n\n<!--__LAYAH_SOMETHING_ELSE__{"a":1}-->`;
    expect(parseTeacherNotesFromPptOutline(notesThenOther)[5]).toContain("Model the word equation");
  });

  it("the Gamma export with notes still passes strict content validation", async () => {
    const { gamma } = await finalDecks();
    const report = compareToSnapshot(payload.snapshot, await extractPptx(gamma));
    expect(report.verdict).toBe("passed");
    expect(report.unexpected).toEqual([]);
  });

  it.runIf(Boolean(process.env.PHOTOSYNTHESIS_EVIDENCE_DIR))("writes the evidence decks and report", async () => {
    const dir = process.env.PHOTOSYNTHESIS_EVIDENCE_DIR!;
    mkdirSync(dir, { recursive: true });
    const { legacy, gamma } = await finalDecks();
    writeFileSync(join(dir, "photosynthesis-grade6-legacy.pptx"), legacy);
    writeFileSync(join(dir, "photosynthesis-grade6-gamma-simulated.pptx"), gamma);
    const texts = slideTexts(await extractPptx(gamma));
    const notes = await readSpeakerNotes(gamma);
    const titled = (i: number) => `${i + 1}. ${payload.slides[i]!.title}${payload.slides[i]!.parts > 1 ? ` (${payload.slides[i]!.part}/${payload.slides[i]!.parts})` : ""}`;
    writeFileSync(join(dir, "evidence.json"), JSON.stringify({
      physicalSlides: payload.slides.map((_, i) => titled(i)),
      questions: resolveQuestionMappingsToPhysicalSlides(deck, payload.slides).map((m) => ({
        question: m.questionText, physicalSlide: m.questionPhysicalSlide, taughtOn: m.sourcePhysicalSlides, expectedAnswer: m.expectedAnswer, result: m.result,
      })),
      studentTextFindings: { legacy: scanStudentFacingText(slideTexts(await extractPptx(legacy))), gamma: scanStudentFacingText(texts) },
      sdgReferences: collectSdgReferences(texts),
      differentiationLabels: texts.filter((_, i) => payload.slides[i]!.deckIdx === 6).flatMap((s) => s.body.split("\n")).filter((l) => /^(Must|Should|Could)$/.test(l.trim())),
      notes: notes.map((n, i) => ({ slide: titled(i), notes: n })),
    }, null, 2));
  });
});
