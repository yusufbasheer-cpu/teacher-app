/**
 * Benchmark: the Force and Pressure lesson (Grade 8 Science), 2026-10-23. The fixture holds the 13 lesson sections
 * reconstructed from the 18-slide platform deck (see __fixtures__/force-and-pressure.json). The Gamma deck for the same
 * lesson came back with 13 slides and ~35% less text; these tests pin the fix offline, without any Gamma call.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import fixture from "./__fixtures__/force-and-pressure.json";
import { buildPptxFromTemplateEngine, moveTeacherFacingLinesToNotes, normalizeToLines } from "@/lib/ppt-template-engine";
import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import { buildCanonicalSlides, buildGammaPayload } from "./payload";
import { checkLayout, compareToSnapshot, extractPptx } from "./validate";
import { pptxFrom, testConfig } from "./test-helpers";
import { isChapterLine } from "@/lib/ppt-slide-guards";

const deck = fixture.deck as StructuredLessonSlideModel[];
const lesson = fixture.lesson;
const platformImages = (i: number) => fixture.platformImageOnSection[i] === true;
const build = (hasImage?: (i: number) => boolean) => buildGammaPayload({ deck, title: "Grade 8 Science: Force and Pressure", language: "en", config: testConfig(), lesson, hasImage });

const sha = (v: string) => createHash("sha256").update(v).digest("hex").slice(0, 16);
/** Lesson text only (cover excluded): equal hashes mean identical educational text, whatever the slide boundaries. */
const contentHash = (slides: ReturnType<typeof buildCanonicalSlides>) => sha(slides.slice(1).flatMap((s) => s.lines).join("\n"));
/** Text plus boundaries: equal hashes mean the same physical slides with the same lines on each. */
const planHash = (slides: ReturnType<typeof buildCanonicalSlides>) => sha(JSON.stringify(slides.map((s) => [s.deckIdx, s.part, s.lines])));
const split = (slides: ReturnType<typeof buildCanonicalSlides>) => deck.map((_, d) => slides.filter((s) => s.deckIdx === d).length).join(",");

describe("regression pins: Force and Pressure physical-slide plan", () => {
  it("Gamma path keeps Extended Task to one slide", () => {
    const slides = buildCanonicalSlides({ deck, lesson });
    expect({ count: slides.length, split: split(slides), content: contentHash(slides), plan: planHash(slides) })
      .toEqual({ count: 16, split: "1,1,1,1,1,1,2,2,2,1,1,1,1", content: "cfb4129322b10bd7", plan: "20134c0bda158eee" });
  });
  it("platform renderer keeps Extended Task to one slide with pictures", () => {
    const slides = buildCanonicalSlides({ deck, lesson, hasImage: platformImages });
    expect({ count: slides.length, split: split(slides), content: contentHash(slides), plan: planHash(slides) })
      .toEqual({ count: 17, split: "1,1,1,1,1,1,2,2,3,1,1,1,1", content: "cfb4129322b10bd7", plan: "b528c10a9d8709a6" });
  });
});

describe("slide count: Gamma gets the platform's slides, not the 13 lesson sections", () => {
  it("reproduces the updated platform deck with one Extended Task slide", () => {
    const slides = buildCanonicalSlides({ deck, lesson, hasImage: platformImages });
    expect(slides).toHaveLength(fixture.platformSlideCount);
    const perSection = fixture.platformChunksPerSection.map((_, i) => slides.filter((s) => s.deckIdx === i).length);
    expect(perSection).toEqual(fixture.platformChunksPerSection);
  });

  it("matches the real platform renderer slide for slide on the Gamma path (no platform pictures)", async () => {
    const slides = buildCanonicalSlides({ deck, lesson });
    const rendered = await extractPptx(await buildPptxFromTemplateEngine({ templateId: "classic", slides: deck, subject: lesson.subject, grade: lesson.grade, topic: lesson.topic }));
    expect(rendered.slides).toHaveLength(slides.length);
    // The platform restyles some lines as it draws them ("SDG GOAL Goal 9 — …" becomes "SDG GOAL GOAL 9  …"), so compare
    // words: every word of every canonical line must be on the same physical slide of the platform deck.
    const words = (t: string) => t.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    slides.forEach((s, i) => {
      if (i === 0) return; // cover is laid out from subject/grade/topic, checked separately
      const onSlide = new Set(words(rendered.slides[i]!.paragraphs.map((p) => p.text).join(" ")));
      for (const w of words(s.lines.join(" "))) expect(onSlide.has(w), `slide ${i + 1}: "${w}"`).toBe(true);
    });
  });
});

describe("content: every platform line reaches Gamma, verbatim and in order", () => {
  it("sends all lesson text in preserve mode, nothing condensed", () => {
    const { request, snapshot } = build();
    expect(request.textMode).toBe("preserve");
    const sent = String(request.inputText);
    let from = 0;
    for (const model of deck.slice(1).map(moveTeacherFacingLinesToNotes)) {
      for (const line of normalizeToLines(model.body)) {
        // A bare "---" separator is removed on purpose: it is Gamma's card delimiter and would split the slide.
        if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) continue;
        // The chapter is shown once, on the title slide, so its repeat on later slides is dropped on purpose.
        if (isChapterLine(line)) continue;
        const at = sent.indexOf(line, from);
        expect(at, line).toBeGreaterThanOrEqual(0);
        from = at;
      }
    }
    const isSeparator = (l: string) => /^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(l);
    const platformChars = deck.slice(1).reduce((n, m) => n + normalizeToLines(moveTeacherFacingLinesToNotes(m).body).filter((l) => !isSeparator(l) && !isChapterLine(l)).join("").length, 0);
    const sentChars = snapshot.slice(1).reduce((n, s) => n + s.lines.slice(1).join("").length, 0);
    expect(sentChars).toBe(platformChars);
  });

  it("passes a faithful design and fails the kind of deck we got back (13 slides, ~35% text dropped)", async () => {
    const { snapshot } = build();
    const faithful = await extractPptx(await pptxFrom(snapshot.map((s) => s.lines)));
    expect(compareToSnapshot(snapshot, faithful).verdict).toBe("passed");

    // Merge continuation slides back into 13 and keep only ~65% of each slide's lines, as the Gamma deck did.
    const merged = new Map<string, string[]>();
    snapshot.forEach((s) => merged.set(s.title, [...(merged.get(s.title) ?? [s.title]), ...s.lines.slice(1)]));
    const condensed = [...merged.values()].map((lines) => lines.slice(0, Math.max(2, Math.ceil(lines.length * 0.65))));
    const report = compareToSnapshot(snapshot, await extractPptx(await pptxFrom(condensed)));
    expect(report.verdict).toBe("failed");
    expect(report.reasons.join(" ")).toMatch(/slide count/);
    expect(report.missing.length).toBeGreaterThan(0);
  });
});

describe("pictures: six required categories, never dominant", () => {
  it("plans one meaningful visual for every required logical category", () => {
    const { layout, slides } = build();
    expect(layout.filter((p) => p.requiredVisualCategory).map((p) => p.requiredVisualCategory)).toEqual([
      "cover", "starter", "topic", "main-phase", "uae-connection", "takeaway",
    ]);
    expect(layout.filter((p) => p.image !== "none")).toHaveLength(6);
    for (const p of layout) if (slides[p.slideIndex]!.part > 1) expect(p.image, `slide ${p.slideIndex + 1}`).toBe("none");
  });

  it("reports image dominance separately from the content verdict", async () => {
    const { snapshot, layout } = build();
    const out = snapshot.map((s, i) => ({ paras: s.lines, pic: i === 6 }));
    const deckOut = await extractPptx(await pptxFrom(out));
    expect(compareToSnapshot(snapshot, deckOut).verdict).toBe("passed");
    expect(checkLayout(layout, deckOut).picturesOnTextOnlySlides.map((f) => f.slide)).toEqual([7]);
  });
});
