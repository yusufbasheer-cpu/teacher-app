import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildStructuredLessonSlides } from "@/lib/ppt-structured-lesson";
import { adaptStructuredLessonSlidesToDeck } from "@/lib/slide-deck-legacy-adapter";
import { buildPptxFromDeckSpec } from "@/lib/ppt-template-engine";
import type { LearningObjectiveLayoutChoice } from "@/lib/ppt-layouts/learning-objective-provisional";

const generate = process.env.GENERATE_PHASE1_ARTIFACTS === "1" ? it : it.skip;

describe("Phase 1 approval artifacts", () => {
  generate("writes three editable presentations with identical educational content", async () => {
    const objective = "Explain how evaporation and condensation transfer water through the water cycle, using particle movement as evidence.";
    const slides = buildStructuredLessonSlides({
      subject: "Science", grade: "Year 7", topic: "The Water Cycle", teacherName: "Layah Teacher",
      learningObjectivesText: objective, language: "en",
    });
    const adapted = adaptStructuredLessonSlidesToDeck({
      slides, subject: "Science", grade: "Year 7", topic: "The Water Cycle", language: "en", themeId: "modern",
    });
    expect(adapted.ok).toBe(true);
    if (!adapted.ok) return;

    const output = path.join(process.cwd(), "artifacts", "phase1.1-learning-objective");
    await mkdir(output, { recursive: true });
    const variants: { id: string; choice: LearningObjectiveLayoutChoice }[] = [
      { id: "existing", choice: "existing" },
      { id: "statement", choice: "lo_statement_01" },
      { id: "target", choice: "lo_target_01" },
    ];
    const slideXmlByVariant = new Map<string, string[]>();
    for (const variant of variants) {
      const buffer = await buildPptxFromDeckSpec({ deck: adapted.deck, templateId: "modern", learningObjectiveLayout: variant.choice });
      expect(buffer.byteLength).toBeGreaterThan(20_000);
      const zip = await JSZip.loadAsync(buffer);
      const slideXml = await zip.file("ppt/slides/slide4.xml")!.async("string");
      const editableText = [...slideXml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map((match) => match[1]).join(" ");
      expect(editableText).toContain(objective);
      const physicalSlides = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
      slideXmlByVariant.set(variant.id, await Promise.all(physicalSlides.map((name) => zip.file(name)!.async("string"))));
      await writeFile(path.join(output, `water-cycle-${variant.id}.pptx`), buffer);
    }
    const baselineSlides = slideXmlByVariant.get("existing")!;
    for (const variant of ["statement", "target"] as const) {
      slideXmlByVariant.get(variant)!.forEach((xml, index) => {
        if (index !== 3) expect(xml, `${variant} changed physical slide ${index + 1}`).toBe(baselineSlides[index]);
      });
    }

    const longObjective = "Compare evaporation and condensation, explain how particle movement and energy change during each process, and use observations from a classroom investigation to justify where both changes occur within the water cycle.";
    const longSlides = buildStructuredLessonSlides({
      subject: "Science", grade: "Year 7", topic: "The Water Cycle", teacherName: "Layah Teacher",
      learningObjectivesText: longObjective, language: "en",
    });
    const longAdapted = adaptStructuredLessonSlidesToDeck({
      slides: longSlides, subject: "Science", grade: "Year 7", topic: "The Water Cycle", language: "en", themeId: "modern",
    });
    expect(longAdapted.ok).toBe(true);
    if (longAdapted.ok) {
      const buffer = await buildPptxFromDeckSpec({ deck: longAdapted.deck, templateId: "modern", learningObjectiveLayout: "lo_statement_01" });
      await writeFile(path.join(output, "water-cycle-statement-long.pptx"), buffer);
    }
  }, 30_000);
});
