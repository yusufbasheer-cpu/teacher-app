import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildPptxFromDeckSpec } from "./ppt-template-engine";
import { selectDeckCompositions } from "./slide-layout-engine";
import type { DeckSpec } from "./slide-schema";

const lessonDeck: DeckSpec = {
  id: "visual-corpus-science-grade-8",
  schemaVersion: 1,
  subject: "Science",
  grade: "Grade 8",
  topic: "Energy and living systems",
  language: "en",
  textDirection: "ltr",
  theme: { id: "classic" },
  slides: [
    {
      id: "corpus-science-diagram", order: 0, title: "How plants store energy", pedagogicalPurpose: "diagram",
      centralTakeaway: "Light energy becomes stored chemical energy.",
      contentBlocks: [
        { type: "paragraph", text: "Trace the energy transfer from sunlight to sugar in a plant cell." },
        { type: "diagram", nodes: [{ id: "sun", label: "Sunlight", kind: "source" }, { id: "leaf", label: "Leaf", kind: "central" }, { id: "sugar", label: "Glucose" }], connections: [{ from: "sun", to: "leaf", label: "captured by" }, { from: "leaf", to: "sugar", label: "stored as" }] },
      ],
      layoutIntent: { density: "light", emphasis: "concept", image: "avoid" },
      speakerNotes: "Ask students to identify where the energy changes form.",
    },
    {
      id: "corpus-math-worked-example", order: 1, title: "Solve a two-step equation", pedagogicalPurpose: "worked-example",
      centralTakeaway: "Undo operations in reverse order and check the solution.",
      contentBlocks: [{ type: "workedExample", prompt: "Solve 3x + 5 = 20", steps: [
        { work: "3x + 5 − 5 = 20 − 5", reasoning: "Subtract 5 from both sides to keep the equation balanced." },
        { work: "3x = 15", reasoning: "Simplify both sides." },
        { work: "x = 5", reasoning: "Divide both sides by 3." },
      ], result: "Check: 3(5) + 5 = 20." }],
      layoutIntent: { density: "moderate", emphasis: "procedure", image: "avoid" },
      speakerNotes: "Model each inverse operation aloud.",
    },
    {
      id: "corpus-comparison", order: 2, title: "Compare physical changes", pedagogicalPurpose: "comparison",
      centralTakeaway: null,
      contentBlocks: [{ type: "comparison", criteria: ["Change", "New substance?", "Can it be reversed?"], items: [
        { label: "Ice melting", values: ["Solid to liquid", "No", "Usually yes"] },
        { label: "Paper burning", values: ["Combustion", "Yes", "No"] },
      ] }],
      layoutIntent: { density: "moderate", emphasis: "evidence", image: "avoid" },
      speakerNotes: "Ask learners to support each comparison with evidence.",
    },
    {
      id: "corpus-class-activity", order: 3, title: "Classify the samples", pedagogicalPurpose: "classroom-activity",
      centralTakeaway: "Use observable evidence to justify each group.",
      contentBlocks: [{ type: "task", instructions: ["Sort the sample cards by physical property.", "Record one observation for each group.", "Explain a borderline example to a partner."], materials: ["sample cards", "sorting mat"], timeMinutes: 9 }],
      layoutIntent: { density: "moderate", emphasis: "practice", image: "avoid" },
      speakerNotes: "Circulate and listen for evidence-based reasons.",
    },
    {
      id: "corpus-formative-check", order: 4, title: "Check your understanding", pedagogicalPurpose: "formative-assessment",
      centralTakeaway: null,
      contentBlocks: [{ type: "question", prompt: "Which observation is evidence of a chemical change?", options: [
        { id: "a", text: "A solid melts into a liquid." }, { id: "b", text: "A new gas forms during a reaction." }, { id: "c", text: "A material is cut into smaller pieces." },
      ], correctOptionIds: ["b"] }],
      layoutIntent: { density: "light", emphasis: "practice", image: "avoid" },
      speakerNotes: "Pause for individual responses before showing the next slide.",
    },
    {
      id: "corpus-reflection", order: 5, title: "Reflect on today's learning", pedagogicalPurpose: "reflection",
      centralTakeaway: null,
      contentBlocks: [{ type: "reflection", prompts: ["Which piece of evidence changed your first idea?"], sentenceStarters: ["At first, I thought energy disappeared.", "Now I can explain where energy goes."] }],
      layoutIntent: { density: "light", emphasis: "reflection", image: "avoid" },
      speakerNotes: "Invite students to write before sharing with a partner.",
    },
    {
      id: "corpus-dense-text", order: 6, title: "Evidence across the investigation", pedagogicalPurpose: "concept-explanation",
      centralTakeaway: null,
      contentBlocks: [{ type: "paragraph", text: Array.from({ length: 18 }, (_, index) => `Evidence point ${index + 1}: learners compare the sample with the model and record one reason for the difference.`).join(" ") }],
      layoutIntent: { density: "dense", emphasis: "evidence", image: "avoid" },
      speakerNotes: "This intentionally dense corpus slide checks semantic continuation.",
    },
    {
      id: "corpus-text-only", order: 7, title: "A useful rule of thumb", pedagogicalPurpose: "concept-explanation",
      centralTakeaway: "A fair test changes one factor at a time.",
      contentBlocks: [{ type: "paragraph", text: "Keep the other conditions the same so the result can be linked to the factor you changed." }],
      layoutIntent: { density: "light", emphasis: "concept", image: "avoid" },
      speakerNotes: "No image is needed for this idea.",
    },
    {
      id: "corpus-objectives", order: 8, title: "Learning objectives", pedagogicalPurpose: "learning-objectives",
      centralTakeaway: null,
      contentBlocks: [{ type: "bulletList", items: ["Describe how energy moves.", "Use evidence from an observation.", "Explain a result with a model."] }],
      layoutIntent: { density: "light", emphasis: "practice", image: "avoid" },
      speakerNotes: "Ask students to choose one objective to self-check.",
    },
    {
      id: "corpus-process", order: 9, title: "Investigate a fair test", pedagogicalPurpose: "process",
      centralTakeaway: "Change one factor and measure its effect.",
      contentBlocks: [{ type: "orderedSteps", items: ["Choose the factor to change.", "Keep other conditions steady.", "Measure the outcome carefully.", "Repeat and compare the results."] }],
      layoutIntent: { density: "moderate", emphasis: "procedure", image: "avoid" },
      speakerNotes: "Check that students identify the independent variable.",
    },
    {
      id: "corpus-retrieval", order: 10, title: "Recall what you learned", pedagogicalPurpose: "plenary",
      centralTakeaway: null,
      contentBlocks: [{ type: "bulletList", items: ["Name one key idea.", "Give an example that supports it.", "Write one question you still have."] }],
      layoutIntent: { density: "light", emphasis: "practice", image: "avoid" },
      speakerNotes: "Use responses to plan the next lesson's opening review.",
    },
    {
      id: "corpus-definition-example", order: 11, title: "Mass and weight", pedagogicalPurpose: "concept-explanation",
      centralTakeaway: null, composition: "definition-and-example",
      contentBlocks: [
        { type: "keyIdea", label: "Definition", text: "Mass measures the amount of matter in an object." },
        { type: "workedExample", prompt: "A 2 kg object is on Earth. What is its weight at 10 N/kg?", steps: [{ work: "Weight = mass × gravitational field strength", reasoning: "Use the relationship and substitute the known values." }, { work: "Weight = 2 × 10 = 20 N" }], result: "The object's weight is 20 N." },
      ],
      layoutIntent: { density: "moderate", emphasis: "concept", image: "avoid" },
      speakerNotes: "Reinforce that mass and weight describe different quantities.",
    },
    {
      id: "corpus-summary-map", order: 12, title: "Connect the key ideas", pedagogicalPurpose: "summary",
      centralTakeaway: null,
      contentBlocks: [{ type: "diagram", nodes: [{ id: "energy", label: "Energy transfer", kind: "central" }, { id: "source", label: "Energy source" }, { id: "store", label: "Energy store" }], connections: [{ from: "energy", to: "source", label: "begins at" }, { from: "energy", to: "store", label: "ends in" }] }],
      layoutIntent: { density: "light", emphasis: "concept", image: "avoid" },
      speakerNotes: "Ask students to explain one connection in their own words.",
    },
  ],
};

const arabicDeck: DeckSpec = {
  id: "visual-corpus-arabic-grade-7",
  schemaVersion: 1,
  subject: "العلوم",
  grade: "الصف السابع",
  topic: "الطاقة",
  language: "ar",
  textDirection: "rtl",
  theme: { id: "classic" },
  slides: [{
    id: "corpus-arabic-reflection", order: 0, title: "تأمل في تعلمك اليوم", pedagogicalPurpose: "reflection",
    centralTakeaway: null,
    contentBlocks: [{ type: "reflection", prompts: ["ما الدليل الذي غيّر فكرتك الأولى؟"], sentenceStarters: ["في البداية اعتقدت أن الطاقة اختفت.", "الآن أستطيع أن أوضح أين انتقلت الطاقة."] }],
    layoutIntent: { density: "light", emphasis: "reflection", image: "avoid" },
    speakerNotes: "امنح الطلاب وقتاً للتفكير قبل المشاركة.",
  }],
};

async function pptxXml(buffer: Buffer): Promise<{ slides: string[]; notes: string[] }> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
  const noteFiles = Object.keys(zip.files).filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
  return {
    slides: await Promise.all(slideFiles.map((name) => zip.file(name)!.async("string"))),
    notes: await Promise.all(noteFiles.map((name) => zip.file(name)!.async("string"))),
  };
}

describe("educational PPTX composition corpus", () => {
  it("exports diagrams, worked examples, comparisons, activities, assessment, reflection, and text-only slides as editable content", async () => {
    const selected = selectDeckCompositions(lessonDeck);
    expect(selected.ok).toBe(true);
    if (selected.ok) {
      expect(selected.deck.slides[11]!.composition).toBe("definition-and-example");
      expect(selected.deck.slides[12]!.composition).toBe("summary-map");
    }
    const buffer = await buildPptxFromDeckSpec({ deck: lessonDeck });
    const archive = await pptxXml(buffer);
    const xml = archive.slides.join("\n");
    expect(archive.slides.length).toBeGreaterThan(lessonDeck.slides.length); // dense paragraph becomes continuation slides
    expect(xml).toContain("Sunlight");
    expect(xml).toContain("captured by");
    expect(xml).toContain("Trace the energy transfer from sunlight to sugar in a plant cell.");
    expect(xml).toContain("Subtract 5 from both sides");
    expect(xml).toContain("Can it be reversed?");
    expect(xml).toContain("sorting mat");
    expect(xml).toContain("Which observation is evidence of a chemical change?");
    expect(xml).toContain("A fair test changes one factor at a time.");
    expect(xml).toContain("Evidence point 18");
    expect(xml).toContain("Describe how energy moves.");
    expect(xml).toContain("Repeat and compare the results.");
    expect(xml).toContain("Change one factor and measure its effect.");
    expect(xml).toContain("Write one question you still have.");
    expect(xml).toContain("Mass measures the amount of matter in an object.");
    expect(xml).toContain("A 2 kg object is on Earth.");
    expect(xml).toContain("Energy source");
    expect(xml).toContain("<p:sp>"); // editable PowerPoint text and geometry, not flattened slide images
    expect(archive.notes.join("\n")).toContain("Teacher answer key: A new gas forms during a reaction.");
    expect(archive.notes.join("\n")).toContain("Model each inverse operation aloud.");
  });

  it("exports Arabic reflection content with RTL paragraph metadata", async () => {
    const buffer = await buildPptxFromDeckSpec({ deck: arabicDeck });
    const archive = await pptxXml(buffer);
    const xml = archive.slides.join("\n");
    expect(xml).toContain("ما الدليل الذي غيّر فكرتك الأولى؟");
    expect(xml).toMatch(/rtl="1"/);
    expect(archive.notes.join("\n")).toContain("امنح الطلاب وقتاً للتفكير قبل المشاركة.");
  });
});
