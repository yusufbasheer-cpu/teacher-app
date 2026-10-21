import { mkdir, writeFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildStructuredLessonSlides } from "@/lib/ppt-structured-lesson";
import { adaptStructuredLessonSlidesToDeck } from "@/lib/slide-deck-legacy-adapter";
import { buildPptxFromDeckSpec } from "@/lib/ppt-template-engine";
import { PROVISIONAL_LEARNING_OBJECTIVE_FLAG } from "@/lib/ppt-layouts/learning-objective-provisional";
import { selectLearningObjectiveLayout } from "@/lib/presentation/layout-selector";
import type { LayoutId } from "@/lib/presentation/layout-registry";

const generate = process.env.GENERATE_PHASE2_ARTIFACTS === "1" ? it : it.skip;

function selectedId(lessonId: string, slideId: string, objective: string): LayoutId | null {
  const selection = selectLearningObjectiveLayout({ enabled: true, lessonId, slideId, content: { objective, label: "Learning Objectives" } });
  return selection.kind === "registered" ? selection.layout.id : null;
}

describe("Phase 2 registry and selector artifacts", () => {
  generate("writes deterministic examples for both registered layouts and the legacy path", async () => {
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

    const slideId = adapted.deck.slides[3]!.id;
    const lessonIds = new Map<LayoutId, string>();
    for (let index = 0; lessonIds.size < 2 && index < 500; index += 1) {
      const lessonId = `phase2-water-cycle-${index}`;
      const id = selectedId(lessonId, slideId, objective);
      if (id && !lessonIds.has(id)) lessonIds.set(id, lessonId);
    }
    expect([...lessonIds.keys()].sort()).toEqual(["lo_statement_01", "lo_target_01"]);

    const output = path.join(process.cwd(), "artifacts", "phase2-layout-registry");
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "selection-manifest.json"), JSON.stringify({
      featureFlag: PROVISIONAL_LEARNING_OBJECTIVE_FLAG,
      defaultEnabled: false,
      objective,
      selections: Object.fromEntries(lessonIds),
    }, null, 2));
    const previousFlag = process.env[PROVISIONAL_LEARNING_OBJECTIVE_FLAG];
    process.env[PROVISIONAL_LEARNING_OBJECTIVE_FLAG] = "true";
    try {
      const xmlByVariant = new Map<string, string[]>();
      for (const layoutId of ["lo_statement_01", "lo_target_01"] as const) {
        const deck = { ...adapted.deck, id: lessonIds.get(layoutId)! };
        const first = await buildPptxFromDeckSpec({ deck, templateId: "modern" });
        const second = await buildPptxFromDeckSpec({ deck, templateId: "modern" });
        const firstZip = await JSZip.loadAsync(first);
        const secondZip = await JSZip.loadAsync(second);
        const firstSlide = await firstZip.file("ppt/slides/slide4.xml")!.async("string");
        const secondSlide = await secondZip.file("ppt/slides/slide4.xml")!.async("string");
        expect(secondSlide).toBe(firstSlide);
        expect(firstSlide).toContain(objective);
        const names = Object.keys(firstZip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
        xmlByVariant.set(layoutId, await Promise.all(names.map((name) => firstZip.file(name)!.async("string"))));
        await writeFile(path.join(output, `water-cycle-auto-${layoutId}.pptx`), first);
      }

      const legacy = await buildPptxFromDeckSpec({ deck: adapted.deck, templateId: "modern", learningObjectiveLayout: "existing" });
      await writeFile(path.join(output, "water-cycle-legacy-fallback.pptx"), legacy);
      const legacyZip = await JSZip.loadAsync(legacy);
      const names = Object.keys(legacyZip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
      const legacySlides = await Promise.all(names.map((name) => legacyZip.file(name)!.async("string")));
      for (const layoutId of ["lo_statement_01", "lo_target_01"] as const) {
        xmlByVariant.get(layoutId)!.forEach((xml, index) => {
          if (index !== 3) expect(xml, `${layoutId} changed physical slide ${index + 1}`).toBe(legacySlides[index]);
        });
      }
    } finally {
      if (previousFlag === undefined) delete process.env[PROVISIONAL_LEARNING_OBJECTIVE_FLAG];
      else process.env[PROVISIONAL_LEARNING_OBJECTIVE_FLAG] = previousFlag;
    }
  }, 30_000);
});
