import { mkdir, writeFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildStructuredLessonSlides } from "@/lib/ppt-structured-lesson";
import { adaptStructuredLessonSlidesToDeck } from "@/lib/slide-deck-legacy-adapter";
import { buildPptxFromDeckSpec } from "@/lib/ppt-template-engine";

const generate = process.env.GENERATE_PHASE4A_ARTIFACTS === "1" ? it : it.skip;

type BenchmarkFixture = {
  slug: string;
  subject: string;
  grade: string;
  topic: string;
  objective: string;
  starter: string;
  teaching: string;
  exitQuestions: string;
  titleImage: string;
  starterImage: string;
};

const FIXTURES: readonly BenchmarkFixture[] = [
  {
    slug: "water-cycle",
    subject: "Science",
    grade: "Year 7",
    topic: "The Water Cycle",
    objective: "Explain how evaporation and condensation transfer water through the water cycle, using particle movement as evidence.",
    starter: "Picture prompt\n\nObserve the water, clouds and sunlight. Where might the water move next? Write one prediction using evaporation or condensation, then compare it with a partner and improve your explanation.",
    teaching: "Evaporation happens when energy gives surface-water particles enough energy to escape as water vapour. Condensation happens when water vapour cools, loses energy and forms liquid droplets. Droplets grow and fall as precipitation; water then collects before the cycle repeats.",
    exitQuestions: "1. What change of state turns liquid water into water vapour?\n2. Explain why droplets form on a cold surface using particle movement.\n3. Predict how stronger solar heating may affect evaporation and justify your answer.",
    titleImage: "https://images.pexels.com/photos/1912962/pexels-photo-1912962.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    starterImage: "https://images.pexels.com/photos/8471913/pexels-photo-8471913.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
  },
  {
    slug: "linear-equations",
    subject: "Mathematics",
    grade: "Year 8",
    topic: "Linear Equations",
    objective: "Solve one-step and two-step linear equations and verify each solution by substitution.",
    starter: "Picture prompt\n\nObserve the equations on the board. Which operation should be undone first in 3x + 5 = 20? Record your choice and reason, then compare it with a partner.",
    teaching: "An equation stays balanced when the same operation is applied to both sides. For 3x + 5 = 20, subtract 5 from both sides, then divide both sides by 3. Substitution confirms that x = 5 because 3(5) + 5 = 20.",
    exitQuestions: "1. Solve x + 7 = 19.\n2. Solve 4x - 3 = 17 and show each inverse operation.\n3. Does x = 6 solve 2x + 5 = 19? Prove your answer by substitution.",
    titleImage: "https://images.pexels.com/photos/6238050/pexels-photo-6238050.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    starterImage: "https://images.pexels.com/photos/6325967/pexels-photo-6325967.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
  },
  {
    slug: "industrial-revolution",
    subject: "History",
    grade: "Year 8",
    topic: "The Industrial Revolution",
    objective: "Explain two causes of industrialisation and evaluate how factory work changed urban life.",
    starter: "Picture prompt\n\nObserve the machinery. What does it suggest about where and how goods were produced? Record two details as evidence, then discuss which change may have affected workers most.",
    teaching: "Coal supplied concentrated energy and inventions increased textile production. Factories brought workers and machines into one workplace, while canals and railways moved materials and goods. Rapid migration expanded towns faster than housing and sanitation.",
    exitQuestions: "1. Identify one energy source that supported industrialisation.\n2. Explain how factories changed where people worked.\n3. Which factor best explains rapid urban growth? Support your judgement with evidence.",
    titleImage: "https://images.pexels.com/photos/30335402/pexels-photo-30335402.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    starterImage: "https://images.pexels.com/photos/16472162/pexels-photo-16472162.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
  },
];

function benchmarkBodies(fixture: BenchmarkFixture): string[] {
  return [
    `${fixture.grade}\n${fixture.topic}`,
    fixture.starter,
    `Chapter: Subject foundations\n\nTopic: ${fixture.topic}\n\nSDG 4 - Quality Education: learning to reason with evidence supports informed decisions and further study.`,
    fixture.objective,
    `You will identify the key knowledge in ${fixture.topic}.\n\nYou will explain a relationship using evidence.\n\nYou will apply the method to an unfamiliar example.`,
    fixture.teaching,
    `Higher Achievers task\nEvaluate an unfamiliar ${fixture.topic} example and justify your conclusion.\n\nMiddle Achievers task\nApply the taught method and show evidence for each step.\n\nLower Achievers task\nComplete the scaffolded example using the supplied prompts.\n\nMini Plenary\nExplain the most important idea to a partner.`,
    `Cross-curricular connection\nUse precise written reasoning to explain ${fixture.topic}. Identify the evidence, connect it to your conclusion, and check that another reader can follow the reasoning.`,
    `Evidence check\n\n1. Write one claim about ${fixture.topic}.\n2. Add evidence from today's example.\n3. Exchange responses and identify one missing reasoning step.`,
    `Independent investigation\n\n1. Choose one unfamiliar ${fixture.topic} example.\n2. Apply today's method and record every step.\n3. Explain the result in 120 words.\n4. Bring the completed response to the next lesson.`,
    fixture.exitQuestions,
    `I can identify the key information in ${fixture.topic}.\n\nI can explain the method using evidence.\n\nI can apply the method to an unfamiliar example.\n\nI can justify and check my conclusion.`,
    `Key takeaway\n${fixture.objective}\n\nBefore you leave, cite one piece of evidence that demonstrates your progress.`,
  ];
}

function makeDeck(fixture: BenchmarkFixture) {
  const bodies = benchmarkBodies(fixture);
  const slides = buildStructuredLessonSlides({
    subject: fixture.subject,
    grade: fixture.grade,
    topic: fixture.topic,
    teacherName: "Phase 4A Review",
    learningObjectivesText: fixture.objective,
    language: "en",
  }).map((slide, index) => ({ ...slide, body: bodies[index] ?? slide.body }));
  const adapted = adaptStructuredLessonSlidesToDeck({
    slides,
    subject: fixture.subject,
    grade: fixture.grade,
    topic: fixture.topic,
    language: "en",
    themeId: "modern",
    deckId: `phase4a-${fixture.slug}`,
    slideImageUrls: [fixture.titleImage, fixture.starterImage],
  });
  if (!adapted.ok) throw new Error(adapted.issues.map((issue) => issue.message).join("; "));
  return adapted.deck;
}

async function inspectPptx(buffer: Buffer, fixture: BenchmarkFixture): Promise<{ slideCount: number; notesCount: number }> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  const notes = Object.keys(zip.files).filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
  const xml = (await Promise.all(slides.map((name) => zip.file(name)!.async("string")))).join("\n");
  expect(xml).toContain(fixture.topic);
  expect(xml).toContain(fixture.exitQuestions.split("\n")[0]!.replace(/^1\.\s*/, ""));
  expect(xml).not.toMatch(/<a:t>\s*\d{1,2}[.)]\s*<\/a:t>/);
  expect(notes).toHaveLength(slides.length);
  return { slideCount: slides.length, notesCount: notes.length };
}

describe("Phase 4A benchmark artifacts", () => {
  generate("writes complete before-and-after Science, Mathematics and History decks", async () => {
    const output = path.join(process.cwd(), "artifacts", "phase4a-title-starter");
    await mkdir(output, { recursive: true });
    const manifest: { provisional: true; featureFlagDefaultEnabled: false; decks: unknown[] } = {
      provisional: true,
      featureFlagDefaultEnabled: false,
      decks: [],
    };
    for (const fixture of FIXTURES) {
      const deck = makeDeck(fixture);
      const legacy = await buildPptxFromDeckSpec({ deck, templateId: "modern", phase4aLayout: "existing", learningObjectiveLayout: "existing" });
      const phase4a = await buildPptxFromDeckSpec({ deck, templateId: "modern", phase4aLayout: "title_hero_01", learningObjectiveLayout: "existing" });
      const typographyActivity = await buildPptxFromDeckSpec({
        deck: { ...deck, slides: deck.slides.map((slide, index) => index < 2 ? { ...slide, image: undefined, layoutIntent: { ...slide.layoutIntent, image: "avoid" as const } } : slide) },
        templateId: "modern",
        phase4aLayout: "title_typography_01",
        learningObjectiveLayout: "existing",
      });
      const [legacyInfo, phase4aInfo, fallbackInfo] = await Promise.all([
        inspectPptx(legacy, fixture), inspectPptx(phase4a, fixture), inspectPptx(typographyActivity, fixture),
      ]);
      await Promise.all([
        writeFile(path.join(output, `${fixture.slug}-legacy.pptx`), legacy),
        writeFile(path.join(output, `${fixture.slug}-phase4a.pptx`), phase4a),
        writeFile(path.join(output, `${fixture.slug}-typography-activity.pptx`), typographyActivity),
      ]);
      manifest.decks.push({ slug: fixture.slug, legacy: legacyInfo, phase4a: phase4aInfo, typographyActivity: fallbackInfo, imageSource: "Pexels API search results embedded into PPTX" });
    }
    await writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
  }, 120_000);
});
