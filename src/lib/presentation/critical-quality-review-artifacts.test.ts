import { mkdir, writeFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildStructuredLessonSlides } from "@/lib/ppt-structured-lesson";
import { adaptStructuredLessonSlidesToDeck } from "@/lib/slide-deck-legacy-adapter";
import { buildPptxFromDeckSpec } from "@/lib/ppt-template-engine";
import { computeDeckQualityReport } from "@/lib/ppt-quality-report";

const generate = process.env.GENERATE_QUALITY_REVIEW_ARTIFACTS === "1" ? it : it.skip;

const bodies = [
  "Year 7\nThe Water Cycle",
  "Predict and justify\n\nStudy a sealed cup containing warm water and ice above it. Predict where droplets will form and explain why using the words evaporation and condensation.\n\nCompare your prediction with a partner, then revise one sentence after observing the cup for two minutes.",
  "Chapter: Earth systems\n\nTopic: The Water Cycle\n\nSDG 6 — Clean Water and Sanitation: understanding how water moves and changes state helps explain why freshwater is limited, how it is renewed, and why protecting clean water stores matters.",
  "Explain how evaporation and condensation transfer water through the water cycle, using particle movement as evidence.",
  "You will identify evaporation, condensation, precipitation and collection in a water-cycle model.\n\nYou will explain each change using energy and particle movement.\n\nYou will use evidence from a diagram to predict how heating changes the rate of evaporation.",
  "Evaporation: energy from the Sun gives surface-water particles enough energy to escape as water vapour.\n\nCondensation: rising air cools; water-vapour particles lose energy, move closer together and form tiny liquid droplets in clouds.\n\nPrecipitation: droplets or ice crystals grow until gravity pulls them to Earth. Water then collects in rivers, lakes, oceans and groundwater before the cycle repeats.\n\nApply it: trace one water particle from the ocean to a cloud and back to land, naming the process at each change.",
  "Higher Achievers task\nPredict how a 5 °C temperature rise could change evaporation and rainfall. Give two linked scientific reasons.\n\nMiddle Achievers task\nLabel the four processes, then explain evaporation and condensation using particles.\n\nLower Achievers task\nOrder the process cards. Complete: particles gain energy during evaporation and lose energy during condensation.\n\nMini Plenary\nWhy can a cloud form even though water vapour is invisible?",
  "Real-life connection\nA cold bathroom mirror collects droplets because warm water vapour cools and condenses on the glass. Meteorologists use the same change of state when explaining cloud formation and rainfall.\n\nCross-curricular link\nIn Geography, compare rainfall and water availability in two climates, then explain the pattern using evaporation and condensation.",
  "Water-particle challenge\n\n1. Draw one particle’s route: ocean → atmosphere → cloud → river.\n2. Label each change and state whether the particle gains or loses energy.\n3. Swap diagrams; check every arrow against the objective.\n4. Improve one explanation using particle movement.\n\nFinal check: why is this a cycle rather than a one-way path?",
  "Mini water-cycle investigation\n\n1. Cover warm water in a clear container with film; place ice above one side.\n2. Predict where droplets will appear.\n3. Record observations every two minutes for ten minutes.\n4. Submit a labelled diagram and 120-word particle explanation next lesson.\n\nChallenge: identify one limitation and improve the method.",
  "1. What change of state turns liquid water into water vapour?\n\n2. Explain why droplets form on the outside of a cold bottle using particle movement.\n\n3. Predict one effect of stronger solar heating on the water cycle and justify your answer.",
  "I can label evaporation, condensation, precipitation and collection on an unfamiliar diagram.\n\nI can explain evaporation and condensation using energy and particles.\n\nI can trace water through four stages without creating or losing water.\n\nI can use evidence to predict how temperature affects evaporation.\n\nSelf-check: cite evidence for one criterion and select one to improve.",
  "Key takeaway\nWater continually moves between stores because energy drives evaporation, cooling causes condensation, gravity produces precipitation, and water collects before cycling again.\n\nBefore you leave, state one piece of evidence that shows you met today’s objective.",
];

describe("critical deck-quality benchmark artifact", () => {
  generate("writes a content-specific editable comparison deck", async () => {
    const slides = buildStructuredLessonSlides({
      subject: "Science", grade: "Year 7", topic: "The Water Cycle",
      teacherName: "Quality Review", learningObjectivesText: bodies[3], language: "en",
    }).map((slide, index) => ({ ...slide, body: bodies[index] ?? slide.body }));
    const report = computeDeckQualityReport(slides);
    expect(report.warnings.join("\n")).not.toMatch(/generic starter|unexplained SDG|core teaching placeholder|missing exit-ticket|generic success/i);
    const adapted = adaptStructuredLessonSlidesToDeck({
      slides, subject: "Science", grade: "Year 7", topic: "The Water Cycle", language: "en", themeId: "modern",
    });
    expect(adapted.ok).toBe(true);
    if (!adapted.ok) return;
    const buffer = await buildPptxFromDeckSpec({ deck: adapted.deck, templateId: "modern", learningObjectiveLayout: "existing" });
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    // This representative content now fits its 13 logical sections without accidental splits.
    // Denser content may still use the preserved semantic-continuation fallback.
    expect(slideXml.length).toBe(13);
    const allXml = (await Promise.all(slideXml.map((name) => zip.file(name)!.async("string")))).join("\n");
    expect(allXml).toContain("evaporation");
    expect(allXml).toContain("What change of state turns liquid water into water vapour?");
    expect(allXml).not.toMatch(/<a:t>\s*\d{1,2}[.)]\s*<\/a:t>/);
    const noteXml = Object.keys(zip.files).filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
    expect(noteXml.length).toBe(13);
    expect((await Promise.all(noteXml.map((name) => zip.file(name)!.async("string")))).join("\n")).toContain("Suggested timing");
    const output = path.join(process.cwd(), "artifacts", "critical-quality-review", "corrected");
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "water-cycle-content-benchmark.pptx"), buffer);
    await writeFile(path.join(output, "quality-report.json"), JSON.stringify(report, null, 2));

    const additional = [
      {
        file: "linear-equations-content-benchmark.pptx", subject: "Mathematics", grade: "Year 8", topic: "Linear Equations",
        objective: "Solve one-step and two-step linear equations and verify each solution by substitution.",
        teaching: "An equation stays balanced when you perform the same inverse operation on both sides. To solve 3x + 5 = 20, subtract 5 from both sides to get 3x = 15, then divide both sides by 3 to get x = 5. Substitute 5 into the original equation: 3(5) + 5 = 20, so the solution is correct.",
        questions: "1. Solve x + 7 = 19.\n2. Solve 4x - 3 = 17 and show each inverse operation.\n3. Sam says x = 6 solves 2x + 5 = 19. Is Sam correct? Prove your answer by substitution.",
      },
      {
        file: "industrial-revolution-content-benchmark.pptx", subject: "History", grade: "Year 8", topic: "The Industrial Revolution",
        objective: "Explain two causes of industrialisation and evaluate how factory work changed urban life.",
        teaching: "Britain industrialised as coal supplied concentrated energy and inventions increased textile production. Factories brought workers and machines into one workplace, while canals and railways moved raw materials and finished goods. Rapid migration expanded towns faster than housing and sanitation, creating crowded living conditions alongside new paid work.",
        questions: "1. Identify one energy source that supported industrialisation.\n2. Explain how factories changed where people worked.\n3. Which factor best explains rapid urban growth? Support your judgement with evidence.",
      },
    ];
    for (const fixture of additional) {
      const extraBodies = bodies.map((body, index) => {
        if (index === 0) return `${fixture.grade}\n${fixture.topic}`;
        if (index === 1) return `Source prediction\n\nStudy the opening example for ${fixture.topic}. Predict one outcome, record evidence, then revise your explanation with a partner.`;
        if (index === 2) return `Chapter: Subject foundations\n\nTopic: ${fixture.topic}\n\nSDG 4 — Quality Education: learning to reason with evidence supports informed decisions and further study.`;
        if (index === 3) return fixture.objective;
        if (index === 4) return `You will identify the key knowledge in ${fixture.topic}.\n\nYou will explain a relationship using evidence.\n\nYou will apply the method to an unfamiliar example.`;
        if (index === 5) return fixture.teaching;
        if (index === 6) return `Higher Achievers task\nEvaluate an unfamiliar ${fixture.topic} example and justify your conclusion.\n\nMiddle Achievers task\nApply the taught method and show the evidence for each step.\n\nLower Achievers task\nComplete the scaffolded example using the supplied prompts.\n\nMini Plenary\nExplain the most important step to a partner.`;
        if (index === 7) return `Cross-curricular connection\nUse precise written reasoning to explain ${fixture.topic}. Identify the evidence, connect it to your conclusion, and check that another reader can follow the reasoning.`;
        if (index === 8) return `Evidence check\n\n1. Write one claim about ${fixture.topic}.\n2. Add evidence from today's example.\n3. Exchange responses and identify one missing reasoning step.`;
        if (index === 9) return `Independent investigation\n\n1. Choose one unfamiliar ${fixture.topic} example.\n2. Apply today's method and record every step.\n3. Explain the result in 120 words.\n4. Bring the completed response to the next lesson.`;
        if (index === 10) return fixture.questions;
        if (index === 11) return `I can identify the key information in ${fixture.topic}.\n\nI can explain the method using evidence.\n\nI can apply the method to an unfamiliar example.\n\nI can justify and check my conclusion.`;
        return `Key takeaway\n${fixture.objective}\n\nBefore you leave, cite one piece of evidence that demonstrates your progress.`;
      });
      const extraSlides = buildStructuredLessonSlides({ subject: fixture.subject, grade: fixture.grade, topic: fixture.topic, teacherName: "Quality Review", learningObjectivesText: fixture.objective, language: "en" }).map((slide, index) => ({ ...slide, body: extraBodies[index] ?? slide.body }));
      const extraDeck = adaptStructuredLessonSlidesToDeck({ slides: extraSlides, subject: fixture.subject, grade: fixture.grade, topic: fixture.topic, language: "en", themeId: "modern" });
      expect(extraDeck.ok).toBe(true);
      if (!extraDeck.ok) continue;
      const extraBuffer = await buildPptxFromDeckSpec({ deck: extraDeck.deck, templateId: "modern", learningObjectiveLayout: "existing" });
      const extraZip = await JSZip.loadAsync(extraBuffer);
      expect(Object.keys(extraZip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length).toBeGreaterThanOrEqual(13);
      await writeFile(path.join(output, fixture.file), extraBuffer);
    }
  }, 30_000);
});
