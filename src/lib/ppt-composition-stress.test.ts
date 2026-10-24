import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { AFL_PHASE_GROUPS } from "@/lib/afl-tools";
import { buildPptxFromDeckSpec } from "./ppt-template-engine";
import type { DeckSpec, EducationalContentBlock, PedagogicalPurpose, SlideSpec } from "./slide-schema";

// Edge-case matrix: every export must either succeed with ALL authored text present in the
// slide XML, or fail. A silent drop (or a crash on ordinary content) is a regression.

const words = (prefix: string, n: number) => `${prefix} ${Array.from({ length: n }, (_, i) => `w${i}`).join(" ")}`;

const takeaways: Record<string, string | null> = {
  none: null,
  short: "Key idea short.",
  long: words("Takeaway long", 38),
};

const blockSets: Record<string, (tag: string) => EducationalContentBlock[]> = {
  paragraph: (t) => [{ type: "paragraph", text: `${t} paragraph one.` }],
  threeParagraphs: (t) => [1, 2, 3].map((i) => ({ type: "paragraph" as const, text: words(`${t} para${i}`, 22) })),
  bullets: (t) => [{ type: "bulletList", items: Array.from({ length: 8 }, (_, i) => `${t} bullet ${i} text`) }],
  steps: (t) => [{ type: "orderedSteps", items: Array.from({ length: 6 }, (_, i) => `${t} step ${i} do it`) }],
  task: (t) => [{ type: "task", instructions: [`${t} do one`, `${t} do two`, `${t} do three`], materials: [`${t} cards`, `${t} glue`], timeMinutes: 7 }],
  taskPlusRows: (t) => [
    { type: "paragraph", text: words(`${t} context`, 40) },
    { type: "task", instructions: [`${t} do one`, `${t} do two`], materials: [`${t} cards`], timeMinutes: 5 },
  ],
  comparison: (t) => [{ type: "comparison", criteria: [`${t} c1`, `${t} c2`, `${t} c3`], items: [
    { label: `${t} A`, values: [`${t} a1`, `${t} a2`, `${t} a3`] },
    { label: `${t} B`, values: [`${t} b1`, `${t} b2`, `${t} b3`] },
  ] }],
  comparisonPlusText: (t) => [
    { type: "paragraph", text: words(`${t} intro`, 30) },
    { type: "comparison", criteria: [`${t} c1`, `${t} c2`], items: [
      { label: `${t} A`, values: [`${t} a1`, `${t} a2`] },
      { label: `${t} B`, values: [`${t} b1`, `${t} b2`] },
    ] },
  ],
  diagram: (t) => [{ type: "diagram", nodes: [
    { id: "a", label: `${t} nodeA`, kind: "central" }, { id: "b", label: `${t} nodeB` }, { id: "c", label: `${t} nodeC` }, { id: "d", label: `${t} nodeD` },
  ], connections: [{ from: "a", to: "b", label: `${t} lab1` }, { from: "a", to: "c", label: `${t} lab2` }, { from: "c", to: "d", label: `${t} lab3` }] }],
  question: (t) => [{ type: "question", prompt: `${t} question prompt?`, options: [{ id: "a", text: `${t} opt A` }, { id: "b", text: `${t} opt B` }, { id: "c", text: `${t} opt C` }] }],
  reflection: (t) => [{ type: "reflection", prompts: [`${t} prompt one?`, `${t} prompt two?`], sentenceStarters: [`${t} starter one`, `${t} starter two`] }],
  sevenRecall: (t) => [{ type: "bulletList", items: Array.from({ length: 7 }, (_, i) => `${t} recall ${i} item`) }],
};

const purposeCases: [PedagogicalPurpose, string[]][] = [
  ["learning-objectives", ["bullets", "paragraph"]],
  ["success-criteria", ["bullets"]],
  ["concept-explanation", ["paragraph", "threeParagraphs", "bullets"]],
  ["process", ["steps", "task"]],
  ["comparison", ["comparison", "comparisonPlusText"]],
  ["diagram", ["diagram"]],
  ["classroom-activity", ["task", "taskPlusRows", "steps"]],
  ["differentiation", ["task"]],
  ["formative-assessment", ["question"]],
  ["plenary", ["bullets", "sevenRecall", "question"]],
  ["summary", ["bullets", "sevenRecall", "diagram"]],
  ["reflection", ["reflection"]],
];

function strings(blocks: EducationalContentBlock[]): string[] {
  return blocks.flatMap((block): string[] => {
    switch (block.type) {
      case "paragraph": case "keyIdea": return [block.text];
      case "bulletList": case "orderedSteps": return block.items;
      case "task": return [...block.instructions, ...(block.materials ?? [])];
      case "comparison": return [...block.criteria, ...block.items.flatMap((i) => [i.label, ...i.values])];
      case "diagram": return [...block.nodes.map((n) => n.label), ...block.connections.flatMap((c) => c.label ? [c.label] : [])];
      case "question": return [block.prompt, ...(block.options ?? []).map((o) => o.text)];
      case "reflection": return [...block.prompts, ...(block.sentenceStarters ?? [])];
      default: return [];
    }
  });
}

async function slideText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const xml = (await Promise.all(files.map((n) => zip.file(n)!.async("string")))).join("\n");
  // Wrapped lines are separate runs; collapse tags and whitespace before substring checks.
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

async function noteText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.keys(zip.files).filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
  const xml = (await Promise.all(files.map((name) => zip.file(name)!.async("string")))).join("\n");
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("composition stress matrix", () => {
  for (const rtl of [false, true]) {
    it(`never crashes or silently drops authored text (${rtl ? "rtl" : "ltr"})`, async () => {
      const failures: string[] = [];
      for (const [purpose, sets] of purposeCases) {
        for (const setName of sets) {
          for (const [tkName, takeaway] of Object.entries(takeaways)) {
            const tag = `${purpose.slice(0, 4)}${setName.slice(0, 4)}${tkName.slice(0, 2)}`;
            const contentBlocks = blockSets[setName]!(tag);
            const slide: SlideSpec = {
              id: `s-${tag}`, order: 0, title: `Stress ${tag}`, pedagogicalPurpose: purpose,
              centralTakeaway: takeaway ? `${tag} ${takeaway}` : null,
              contentBlocks, layoutIntent: { density: "moderate", emphasis: "concept", image: "avoid" }, speakerNotes: `notes ${tag}`,
            };
            const deck: DeckSpec = {
              id: `stress-${tag}`, schemaVersion: 1, subject: "Science", grade: "Grade 8", topic: "Stress",
              language: rtl ? "ar" : "en", textDirection: rtl ? "rtl" : "ltr", theme: { id: "classic" }, slides: [slide],
            };
            const label = `${purpose}/${setName}/${tkName}`;
            try {
              const text = await slideText(await buildPptxFromDeckSpec({ deck }));
              const expected = [...strings(contentBlocks), ...(slide.centralTakeaway ? [slide.centralTakeaway] : [])];
              // Fitting may split a paragraph across continuation slides, so compare word multiplicity, not substrings.
              const have = new Map<string, number>();
              for (const word of text.split(" ")) have.set(word, (have.get(word) ?? 0) + 1);
              const need = new Map<string, number>();
              for (const word of expected.join(" ").split(/\s+/).filter(Boolean)) need.set(word, (need.get(word) ?? 0) + 1);
              for (const [word, count] of need) {
                if ((have.get(word) ?? 0) < count) { failures.push(`${label}: lost word "${word}"`); break; }
              }
            } catch (error) {
              failures.push(`${label}: threw ${error instanceof Error ? error.message.slice(0, 110) : String(error)}`);
            }
          }
        }
      }
      expect(failures).toEqual([]);
    }, 120_000);
  }

  it("preserves structured opening diagrams, renders activity text once, and keeps source notes once across continuations", async () => {
    const continuationText = Array.from({ length: 18 }, (_, index) => `Continuation evidence ${index + 1}: students compare observations and explain the result with a model.`).join(" ");
    const aflTool = AFL_PHASE_GROUPS.find((group) => group.phase === "main")!.tools[0]!;
    const deck: DeckSpec = {
      id: "integrity-review-deck", schemaVersion: 1, subject: "Science", grade: "Grade 8", topic: "Evidence", language: "en", textDirection: "ltr", theme: { id: "classic" },
      slides: [
        {
          id: "opening-diagram", order: 0, title: "Follow the evidence", pedagogicalPurpose: "opening", centralTakeaway: "The labels show how the evidence is connected.",
          contentBlocks: [{ type: "diagram", nodes: [{ id: "sample", label: "Observed sample" }, { id: "model", label: "Scientific model" }], connections: [{ from: "sample", to: "model", label: "compared with" }] }],
          layoutIntent: { image: "avoid" }, speakerNotes: "Ask students to explain the arrow.",
        },
        {
          id: "activity-text", order: 1, title: "Explain the observation", pedagogicalPurpose: "classroom-activity", centralTakeaway: "Unique activity body appears once for this integrity check.",
          contentBlocks: [{ type: "paragraph", text: "Unique activity body appears once for this integrity check." }],
          layoutIntent: { image: "avoid" }, speakerNotes: "Listen for a reason linked to evidence.",
        },
        {
          id: "continued-notes", order: 2, title: "Evidence across the investigation", pedagogicalPurpose: "concept-explanation", centralTakeaway: null,
          contentBlocks: [{ type: "paragraph", text: continuationText }],
          layoutIntent: { image: "avoid" }, speakerNotes: "Unique teacher note for this logical slide.",
          afl: { phase: "main", selectedToolIds: [aflTool.id], provenance: "teacher-selected" },
        },
      ],
    };
    const buffer = await buildPptxFromDeckSpec({ deck });
    const text = await slideText(buffer);
    const notes = await noteText(buffer);
    expect(text).toContain("compared with");
    expect(text.match(/Unique activity body appears once for this integrity check/g)).toHaveLength(1);
    expect(text).toContain("The labels show how the evidence is connected.");
    expect(text).toContain("Continuation evidence 18");
    expect(notes.match(/Unique teacher note for this logical slide/g)).toHaveLength(1);
    expect(notes).toContain("Assessment for learning");
    expect(notes.split(aflTool.label).length - 1).toBe(1);
  });

  it("returns a clear composition error instead of emitting an overfull diagram", async () => {
    const nodes = Array.from({ length: 13 }, (_, index) => ({ id: `node-${index}`, label: `Node ${index}` }));
    const deck: DeckSpec = {
      id: "oversized-diagram-review", schemaVersion: 1, subject: "Science", grade: "Grade 8", topic: "Systems", language: "en", textDirection: "ltr", theme: { id: "classic" },
      slides: [{
        id: "oversized-diagram", order: 0, title: "System map", pedagogicalPurpose: "diagram", centralTakeaway: null,
        contentBlocks: [{ type: "diagram", nodes, connections: [] }], layoutIntent: { image: "avoid" }, speakerNotes: "",
      }],
    };
    await expect(buildPptxFromDeckSpec({ deck })).rejects.toThrow(/up to 12 nodes and 24 connections per slide/);
  });

  it("returns a clear composition error instead of squeezing four comparison columns", async () => {
    const deck: DeckSpec = {
      id: "overwide-comparison-review", schemaVersion: 1, subject: "Science", grade: "Grade 8", topic: "States", language: "en", textDirection: "ltr", theme: { id: "classic" },
      slides: [{
        id: "overwide-comparison", order: 0, title: "Compare the states", pedagogicalPurpose: "comparison", centralTakeaway: null,
        contentBlocks: [{ type: "comparison", criteria: ["Keeps shape"], items: [
          { label: "Solid", values: ["Yes"] }, { label: "Liquid", values: ["No"] }, { label: "Gas", values: ["No"] }, { label: "Plasma", values: ["No"] },
        ] }],
        layoutIntent: { image: "avoid" }, speakerNotes: "",
      }],
    };
    await expect(buildPptxFromDeckSpec({ deck })).rejects.toThrow(/compare at most three items on one slide/);
  });
});
