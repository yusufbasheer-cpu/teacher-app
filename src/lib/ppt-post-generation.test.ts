import { beforeEach, describe, expect, it, vi } from "vitest";

const shortenSlideToLimit = vi.hoisted(() => vi.fn());
const regenerateSlideNotes = vi.hoisted(() => vi.fn());
const rewriteSdgSentence = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ppt-individual-slide-generator", () => ({ shortenSlideToLimit, regenerateSlideNotes, rewriteSdgSentence }));

import { finishGeneratedDeck, uniqueNoteKeys } from "./ppt-post-generation";
import type { SlideGenResult } from "./ppt-individual-slide-generator";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const slide = (body: string, teacherNotes = "Timing: 2 minutes"): SlideGenResult => ({ body, teacherNotes, notices: [] });
const titles = Array.from({ length: 13 }, (_, i) => `Slide ${i + 1}`);

beforeEach(() => {
  shortenSlideToLimit.mockReset();
  regenerateSlideNotes.mockReset();
  rewriteSdgSentence.mockReset();
});

describe("finishGeneratedDeck", () => {
  it("sends only over-limit slides to be shortened, never the teacher's objectives, main phase or extended task", async () => {
    shortenSlideToLimit.mockImplementation(async ({ limit }: { limit: number }) => ({ body: words(limit - 5), ok: true, words: limit - 5, attempts: 1 }));
    const bodies = titles.map(() => slide(words(40)));
    bodies[1] = slide(words(95)); // starter: limit 80
    bodies[3] = slide(words(90)); // objectives: teacher's words
    bodies[5] = slide(words(300)); // main phase: no limit
    bodies[7] = slide(words(120)); // UAE: limit 70
    bodies[9] = slide(words(200)); // extended task: own rules
    const report = await finishGeneratedDeck(bodies, { titles, language: "en" });
    expect(shortenSlideToLimit.mock.calls.map(([p]) => p.limit)).toEqual([80, 70]);
    expect(report.words.find((w) => w.slide === 8)).toMatchObject({ before: 120, after: 65, limit: 70, shortened: true });
    expect(report.words.find((w) => w.slide === 4)?.note).toMatch(/teacher's own words/);
    expect(bodies[5]!.body).toBe(words(300));
  });

  it("keeps the original when shortening would lose a question", async () => {
    shortenSlideToLimit.mockResolvedValue({ body: words(95), ok: false, words: 95, attempts: 2 });
    const bodies = titles.map(() => slide("short"));
    bodies[1] = slide(words(95));
    const report = await finishGeneratedDeck(bodies, { titles, language: "en" });
    expect(bodies[1]!.body).toBe(words(95));
    expect(report.words[1]).toMatchObject({ shortened: false, after: 95 });
  });

  it("puts one official SDG on every slide that mentions one", async () => {
    const bodies = titles.map(() => slide("Plants need light."));
    bodies[2] = slide("Topic: Photosynthesis\nSDG 2 — zero hunger");
    bodies[6] = slide("Link this to SDG 2 — Zero hunger. Farms need healthy plants.");
    const report = await finishGeneratedDeck(bodies, { titles, language: "en" });
    expect(report.sdg).toEqual({ id: 2, name: "Zero Hunger" });
    // Same goal, only the name corrected: the sentence after it is kept.
    expect(bodies[6]!.body).toBe("Link this to SDG 2 — Zero Hunger. Farms need healthy plants.");
  });

  it("gives a line that cited a different goal a new sentence about the right one (never the old goal's sentence)", async () => {
    rewriteSdgSentence.mockResolvedValueOnce("The UAE grows more food in greenhouses to feed everyone.");
    const bodies = titles.map(() => slide("Plants need light."));
    bodies[2] = slide("Topic: Photosynthesis\nSDG 2 — Zero Hunger");
    bodies[7] = slide("SDG: SDG 7 — Affordable and Clean Energy. The UAE uses solar energy.");
    bodies[8] = slide("SDG 7 — Getting to Know Plants. Plants need energy.");
    rewriteSdgSentence.mockResolvedValueOnce(undefined);
    await finishGeneratedDeck(bodies, { titles, language: "en", topic: "Photosynthesis", uae: true });
    expect(bodies[7]!.body).toBe("SDG: SDG 2 — Zero Hunger. The UAE grows more food in greenhouses to feed everyone.");
    // If no correct sentence can be written, only the corrected label stays.
    expect(bodies[8]!.body).toBe("SDG 2 — Zero Hunger");
    expect(rewriteSdgSentence).toHaveBeenCalledWith(expect.objectContaining({ sdgLabel: "SDG 2 — Zero Hunger", topic: "Photosynthesis", uae: true }));
  });

  it("regenerates notes that repeat another slide's line, and drops the line if regeneration repeats too", async () => {
    const bodies = titles.map((t) => slide("text", `Timing: 2 minutes\nSay/Ask: "${t} question?"`));
    bodies[4] = slide("text", "Timing: 3 minutes\nWatch for: mixing up roots and stems.");
    bodies[8] = slide("text", "Timing: 3 minutes\nWatch for: Mixing up roots and stems");
    bodies[10] = slide("text", "Timing: 3 minutes\nWatch for: mixing up roots and stems");
    regenerateSlideNotes.mockResolvedValueOnce("Timing: 3 minutes\nWatch for: thinking plants eat soil.").mockResolvedValueOnce("Timing: 3 minutes\nWatch for: mixing up roots and stems.");
    const report = await finishGeneratedDeck(bodies, { titles, language: "en" });
    expect(report.repeatedNotes).toEqual([
      { slide: 9, repeated: ["mixing up roots and stems"], regenerated: true },
      { slide: 11, repeated: ["mixing up roots and stems"], regenerated: false },
    ]);
    expect(bodies[8]!.teacherNotes).toContain("thinking plants eat soil");
    expect(bodies[10]!.teacherNotes).not.toMatch(/roots and stems/);
    const all = bodies.flatMap((b) => uniqueNoteKeys(b.teacherNotes));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("sameWatchFor (the same difficulty in other words is still a repeat)", () => {
  it("catches the paraphrases a real deck produced, but not different difficulties", async () => {
    const { sameWatchFor } = await import("./ppt-post-generation");
    const a = "Students may think plants get food from soil rather than making it in leaves. Prompt: 'Where does the plant make its food?'";
    const b = "Students may think plants get food from soil rather than sunlight; prompt with \"Where does the plant's energy come from?\"";
    const c = "Students writing 'sunlight' and 'oxygen' in the wrong blanks of the word equation.";
    expect(sameWatchFor(a, b)).toBe(true);
    expect(sameWatchFor(a, c)).toBe(false);
  });
});
