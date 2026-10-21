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
    // The current DeckSpec renderer still creates semantic continuation slides for three
    // dense sections. Preserve that evidence for this review instead of hiding the blocker.
    expect(slideXml.length).toBe(16);
    const allXml = (await Promise.all(slideXml.map((name) => zip.file(name)!.async("string")))).join("\n");
    expect(allXml).toContain("evaporation");
    expect(allXml).toContain("What change of state turns liquid water into water vapour?");
    const output = path.join(process.cwd(), "artifacts", "critical-quality-review", "corrected");
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "water-cycle-content-benchmark.pptx"), buffer);
    await writeFile(path.join(output, "quality-report.json"), JSON.stringify(report, null, 2));
  }, 30_000);
});
