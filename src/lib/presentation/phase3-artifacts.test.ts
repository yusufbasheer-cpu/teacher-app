import { mkdir, writeFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildStructuredLessonSlides } from "@/lib/ppt-structured-lesson";
import { adaptStructuredLessonSlidesToDeck } from "@/lib/slide-deck-legacy-adapter";
import { buildPptxFromDeckSpec } from "@/lib/ppt-template-engine";
import { PROVISIONAL_LEARNING_OBJECTIVE_FLAG } from "@/lib/ppt-layouts/learning-objective-provisional";
import { selectLearningObjectiveLayout } from "@/lib/presentation/layout-selector";

const generate = process.env.GENERATE_PHASE3_ARTIFACTS === "1" ? it : it.skip;
const PEXELS_OPTIONAL_IMAGE = "https://images.pexels.com/photos/414612/pexels-photo-414612.jpeg";

function makeDeck(objective: string, id: string) {
  const slides = buildStructuredLessonSlides({
    subject: "Science", grade: "Year 7", topic: "The Water Cycle", teacherName: "Layah Teacher",
    learningObjectivesText: objective, language: "en",
  });
  const adapted = adaptStructuredLessonSlidesToDeck({
    slides, subject: "Science", grade: "Year 7", topic: "The Water Cycle", language: "en", themeId: "modern", deckId: id,
  });
  expect(adapted.ok).toBe(true);
  if (!adapted.ok) throw new Error("Could not adapt the Phase 3 fixture.");
  return adapted.deck;
}

async function slideXmls(buffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  return Promise.all(names.map((name) => zip.file(name)!.async("string")));
}

function xmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("'", "&apos;").replaceAll('"', "&quot;");
}

describe("Phase 3 content-fit artifacts", () => {
  generate("writes editable short, near-limit, long, oversized, image, and legacy samples", async () => {
    const cases = [
      { name: "short", objective: "Explain evaporation and condensation." },
      { name: "near-target-limit", objective: "Explain how evaporation and condensation move water through the water cycle, using particle movement as evidence." },
      { name: "long-statement", objective: "Explain how solar energy drives evaporation, how cooling causes condensation, and how precipitation and collection move water through Earth's systems, using particle movement and changes of state as evidence." },
      { name: "oversized-legacy", objective: "Explain how energy from the Sun drives evaporation from oceans and land, how rising water vapour cools and condenses into clouds, how precipitation returns water to Earth's surface, how collection and runoff move water through rivers and groundwater, and how particle movement provides evidence for each change of state in the complete water cycle." },
    ] as const;
    const output = path.join(process.cwd(), "artifacts", "phase3-content-fit");
    await mkdir(output, { recursive: true });
    const previous = process.env[PROVISIONAL_LEARNING_OBJECTIVE_FLAG];
    process.env[PROVISIONAL_LEARNING_OBJECTIVE_FLAG] = "true";
    const manifest: Record<string, unknown> = { featureFlag: PROVISIONAL_LEARNING_OBJECTIVE_FLAG, defaultEnabled: false, cases: [] };
    try {
      for (const fixture of cases) {
        const deck = makeDeck(fixture.objective, `phase3-${fixture.name}`);
        const content = { objective: deck.slides[3]!.contentBlocks.flatMap((block) => block.type === "paragraph" ? [block.text] : block.type === "bulletList" ? block.items : []).join("\n"), label: deck.slides[3]!.title };
        const selection = selectLearningObjectiveLayout({ enabled: true, lessonId: deck.id, slideId: deck.slides[3]!.id, content });
        const start = performance.now();
        const buffer = await buildPptxFromDeckSpec({
          deck,
          templateId: "modern",
          ...(fixture.name === "near-target-limit" ? { slideImageUrls: [PEXELS_OPTIONAL_IMAGE] } : {}),
        });
        const durationMs = Math.round(performance.now() - start);
        const xml = await slideXmls(buffer);
        expect(xml[3]).toContain(xmlText(fixture.objective));
        expect(xml[3]).toMatch(/<a:t>/);
        await writeFile(path.join(output, `${fixture.name}.pptx`), buffer);
        (manifest.cases as unknown[]).push({ name: fixture.name, inputCharacters: fixture.objective.length, renderedCharacters: content.objective.length, selection: selection.kind === "registered" ? selection.layout.id : `legacy:${selection.reason}`, durationMs, optionalImage: fixture.name === "near-target-limit" });
      }

      const comparisonDeck = makeDeck(cases[1].objective, "phase3-comparison");
      const legacyStart = performance.now();
      const legacy = await buildPptxFromDeckSpec({ deck: comparisonDeck, templateId: "modern", learningObjectiveLayout: "existing" });
      const legacyMs = Math.round(performance.now() - legacyStart);
      const registeredStart = performance.now();
      const registered = await buildPptxFromDeckSpec({ deck: comparisonDeck, templateId: "modern" });
      const registeredMs = Math.round(performance.now() - registeredStart);
      const [legacyXml, registeredXml] = await Promise.all([slideXmls(legacy), slideXmls(registered)]);
      registeredXml.forEach((xml, index) => { if (index !== 3) expect(xml, `physical slide ${index + 1}`).toBe(legacyXml[index]); });
      expect(registeredXml[3]).toContain(xmlText(cases[1].objective));
      manifest.performance = { legacyMs, registeredMs, deltaMs: registeredMs - legacyMs, note: "Single local runs; operational comparison only, not a statistical benchmark." };
      await writeFile(path.join(output, "legacy-comparison.pptx"), legacy);
      await writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
    } finally {
      if (previous === undefined) delete process.env[PROVISIONAL_LEARNING_OBJECTIVE_FLAG];
      else process.env[PROVISIONAL_LEARNING_OBJECTIVE_FLAG] = previous;
    }
  }, 60_000);
});
