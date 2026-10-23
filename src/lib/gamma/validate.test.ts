import { describe, expect, it } from "vitest";
import { LEARNING_OBJECTIVES_SLIDE_INDEX } from "@/lib/ppt-structured-lesson";
import { autoNumberLabel, compareCondensed, compareToSnapshot, extractPptx, validateGammaDeck } from "./validate";
import { makeDeck, pptxFrom, sourceLines, sourceSnapshot, type ParaSpec, type SlideSpec } from "./test-helpers";

const check = async (slides: (ParaSpec[] | SlideSpec)[], deck = makeDeck()) =>
  compareToSnapshot(sourceSnapshot(deck), await extractPptx(await pptxFrom(slides)));

describe("baseline behaviour", () => {
  it("passes when the text equals the source, ignoring bullet markers / whitespace", async () => {
    const out = sourceLines().map((lines) => lines.map((l) => (l.startsWith("Point") ? `  ${l}   ` : l)));
    const r = await compareToSnapshot(sourceSnapshot(), await extractPptx(await pptxFrom(out, 5)));
    expect(r.reasons).toEqual([]);
    expect(r.verdict).toBe("passed");
    expect(r.pictures).toBe(5);
    expect(r.mediaFiles).toBe(5);
  });
  it("flags a changed number and operator (3x + 5 = 20 → 3x - 5 = 25) as FAILED", async () => {
    const r = await check(sourceLines().map((l) => l.map((x) => x.replace("3x + 5 = 20", "3x - 5 = 25"))));
    expect(r.verdict).toBe("failed");
    expect(r.numbers.missing).toContain("20");
    expect(r.numbers.unexpected).toContain("25");
    expect(r.operators.missing).toContain("+");
  });
  it("flags missing questions, unexpected text, missing slides", async () => {
    const out = sourceLines();
    out[3] = out[3].filter((l) => !l.endsWith("?"));
    out[0].push("Fun fact: Gamma invented this sentence");
    const r = await check(out.slice(0, 12));
    expect(r.verdict).toBe("failed");
    expect(r.questions.missing).toContain("What is x?");
    expect(r.unexpected.some((u) => u.text.startsWith("Fun fact"))).toBe(true);
    expect(r.reasons.join()).toMatch(/slide count 12/);
  });
  it("detects a line on the wrong slide, and lines reordered within a slide", async () => {
    const out = sourceLines();
    out[2].push(out[1].pop()!);
    const moved = await check(out);
    expect(moved.movedBetweenSlides[0]).toMatchObject({ expectedSlide: 2, foundSlide: 3 });
    const swapped = sourceLines();
    swapped[5] = [swapped[5][0], swapped[5][2], swapped[5][1]];
    const r = await check(swapped);
    expect(r.reorderedOnSlide).toContain(6);
    expect(r.verdict).toBe("failed");
  });
});

describe("finding 6 — numeric lines vs slide numbers", () => {
  const deckWithAnswer = () => {
    const d = makeDeck();
    d[4] = { ...d[4], body: "Answer:\n42\n100" };
    return d;
  };
  it("preserves a legitimate numeric-only line such as 42 and 100", async () => {
    const r = await check(sourceLines(deckWithAnswer()), deckWithAnswer());
    expect(r.verdict).toBe("passed");
    expect(r.missing).toEqual([]);
  });
  it("drops slide numbers structurally: placeholder shapes and slidenum fields, whatever their digits", async () => {
    const slides: SlideSpec[] = sourceLines(deckWithAnswer()).map((paras, i) => ({ paras, sldNumPlaceholder: String(i + 1), sldNumField: i % 2 ? "999" : undefined }));
    const r = await check(slides, deckWithAnswer());
    expect(r.verdict).toBe("passed");
    expect(r.unexpected).toEqual([]);
    expect(r.numbers.unexpected).toEqual([]);
  });
  it("a deleted answer is still detected even though slide numbers exist", async () => {
    const out = sourceLines(deckWithAnswer());
    out[4] = out[4].filter((l) => l !== "42");
    const r = await check(out.map((paras, i) => ({ paras, sldNumPlaceholder: String(i + 1) })), deckWithAnswer());
    expect(r.verdict).toBe("failed");
    expect(r.missing).toContainEqual({ slide: 5, text: "42" });
  });
});

describe("finding 7 — soft line breaks", () => {
  const deck = () => {
    const d = makeDeck();
    d[1] = { ...d[1], body: "Step one\nStep two" };
    return d;
  };
  it.each(["self", "wrapped"] as const)("<a:br> (%s form) keeps the runs separated and the lines match", async (form) => {
    const lines = sourceLines(deck());
    const slides: ParaSpec[][] = lines.map((l, i) => (i === 1 ? [l[0], { text: "Step one\nStep two", br: form }] : l));
    const xml = await extractPptx(await pptxFrom(slides));
    expect(xml.slides[1].paragraphs[1].text).toBe("Step one\nStep two");
    const r = compareToSnapshot(sourceSnapshot(deck()), xml);
    expect(r.verdict).toBe("passed");
  });
  it("without the fix the words would have been glued: 'Step oneStep two' must never appear", async () => {
    const xml = await extractPptx(await pptxFrom([[{ text: "Step one\nStep two", br: "wrapped" }]]));
    expect(xml.slides[0].paragraphs[0].text).not.toContain("oneStep");
  });
});

describe("finding 8 — numbered lists stored as formatting", () => {
  const lo = LEARNING_OBJECTIVES_SLIDE_INDEX;
  const numbered = (over: (l: string[][]) => (ParaSpec[] | SlideSpec)[]) => check(over(sourceLines()));
  const withAuto = (scheme: string, startAt?: number) => (lines: string[][]) =>
    lines.map((l, i) => (i === lo ? [l[0], l[1], l[2], { text: "Subtract 5", autoNum: scheme, startAt }, { text: "Divide by 3", autoNum: scheme, startAt }] : l));

  it("reconstructs 1., 2. from <a:buAutoNum> so numbering stored as formatting is NOT a false failure", async () => {
    const r = await numbered(withAuto("arabicPeriod"));
    expect(r.reasons).toEqual([]);
    expect(r.verdict).toBe("passed");
    expect(r.numbers.missing).toEqual([]);
  });
  it("also accepts literal-text numbering", async () => {
    expect((await numbered((l) => l)).verdict).toBe("passed");
  });
  it("honours startAt, and restarts after an unnumbered paragraph", async () => {
    const xml = await extractPptx(await pptxFrom([[{ text: "a", autoNum: "arabicPeriod", startAt: 3 }, { text: "b", autoNum: "arabicPeriod", startAt: 3 }, "plain", { text: "c", autoNum: "arabicPeriod" }]]));
    expect(xml.slides[0].paragraphs.map((p) => p.text)).toEqual(["3. a", "4. b", "plain", "1. c"]);
  });
  it.each([
    ["arabicPeriod", 1, "1."], ["arabicParenR", 2, "2)"], ["arabicParenBoth", 3, "(3)"], ["alphaLcPeriod", 2, "b."],
    ["alphaUcParenR", 27, "AA)"], ["romanLcPeriod", 4, "iv."], ["romanUcPeriod", 9, "IX."], ["arabicPlain", 5, "5"],
  ])("label for %s #%i is %s", (scheme, n, expected) => {
    expect(autoNumberLabel(scheme, n)).toBe(expected);
  });
  it("a wrong auto-number start is a real content failure (numbers differ), not a pass", async () => {
    const r = await numbered(withAuto("arabicPeriod", 2));
    expect(r.verdict).toBe("failed");
  });
  it("numbering lost entirely (plain text, no metadata) is UNCERTAIN, not a content failure", async () => {
    const r = await numbered((l) => l.map((x, i) => (i === lo ? [x[0], x[1], x[2], "Subtract 5", "Divide by 3"] : x)));
    expect(r.reasons).toEqual([]);
    expect(r.verdict).toBe("uncertain");
    expect(r.uncertainties.join()).toMatch(/ordered-list numbering differs on slide\(s\) 4/);
  });
  it("numbering ADDED to an unnumbered list is uncertain too", async () => {
    const r = await numbered((l) => l.map((x, i) => (i === 2 ? [x[0], { text: x[1], autoNum: "arabicPeriod" }, { text: x[2], autoNum: "arabicPeriod" }] : x)));
    expect(r.reasons).toEqual([]);
    expect(r.verdict).toBe("uncertain");
  });
  it("an unsupported numbering scheme is reported as uncertain", async () => {
    const r = await numbered((l) => l.map((x, i) => (i === 2 ? [x[0], { text: x[1], autoNum: "circleNumDbPlain" }, x[2]] : x)));
    expect(r.verdict).toBe("uncertain");
    expect(r.uncertainties.join()).toContain("circleNumDbPlain");
  });
  it("charts/diagrams are flagged uncertain (their text cannot be read), never silently passed", async () => {
    const r = await check(sourceLines().map((paras, i) => ({ paras, chart: i === 7 })));
    expect(r.verdict).toBe("uncertain");
    expect(r.uncertainties.join()).toMatch(/slide\(s\) 8/);
  });
  it("hard evidence outranks uncertainty: failed + uncertain together is FAILED", async () => {
    const out = sourceLines().map((l, i) => (i === 7 ? [...l, "Invented sentence"] : l));
    const r = await check(out.map((paras, i) => ({ paras, chart: i === 2 })));
    expect(r.verdict).toBe("failed");
    expect(r.uncertainties.length).toBeGreaterThan(0);
  });
});

describe("finding 9 — learning-objectives index comes from the shared constant", () => {
  it("checks the slide at LEARNING_OBJECTIVES_SLIDE_INDEX", async () => {
    const out = sourceLines();
    out[LEARNING_OBJECTIVES_SLIDE_INDEX] = out[LEARNING_OBJECTIVES_SLIDE_INDEX].map((l) => l.replace("Solve", "Simplify"));
    const r = await check(out);
    expect(r.learningObjectivesPreserved).toBe(false);
    expect(r.reasons.join()).toMatch(/learning objectives/);
  });
  it("is not affected by changes on other slides", async () => {
    const out = sourceLines();
    out[7] = [...out[7], "extra"];
    expect((await check(out)).learningObjectivesPreserved).toBe(true);
  });
  it("is null (not a failure) when the deck has no such slide", () => {
    const short = sourceSnapshot(makeDeck(2));
    const r = compareToSnapshot(short, { slides: short.map((s) => ({ paragraphs: s.lines.map((text) => ({ text, autoNumbered: false })), pictures: 0, opaqueContent: false })), mediaFiles: 0, unsupportedNumbering: [] });
    expect(r.learningObjectivesPreserved).toBeNull();
    expect(r.verdict).toBe("passed");
  });
});

describe("condensed-mode validation", () => {
  const deck = () => sourceSnapshot();
  const shortened = () => deck().map((s) => ({ paras: [s.title, "short version"] }));
  it("passes a deck that keeps every slide and title even though wording was shortened", async () => {
    const r = compareCondensed(deck(), await extractPptx(await pptxFrom(deck().map((s) => [s.title, ...s.lines.slice(1)]))));
    expect(r.verdict).toBe("passed");
  });
  it("flags reworded titles for review rather than failing", async () => {
    const out = shortened();
    out[3] = { paras: ["Something else", "short version"] };
    const r = compareCondensed(deck(), await extractPptx(await pptxFrom(out)));
    expect(r.verdict).toBe("uncertain");
    expect(r.modified.map((m) => m.slide)).toContain(4);
  });
  it("fails when slides are merged or split", async () => {
    const r = compareCondensed(deck(), await extractPptx(await pptxFrom(shortened().slice(0, 10))));
    expect(r.verdict).toBe("failed");
  });
  it("routes by text mode", async () => {
    const x = await extractPptx(await pptxFrom(shortened()));
    expect(validateGammaDeck("condense", deck(), x).verdict).not.toBe("failed");
    expect(validateGammaDeck("preserve", deck(), x).verdict).toBe("failed");
  });
});
