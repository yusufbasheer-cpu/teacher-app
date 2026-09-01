import { describe, expect, it, vi } from "vitest";
import PptxGenJS from "pptxgenjs";
import { drawBulletBlock, isGroupHeaderLine, splitLeadIn } from "./ppt-render-primitives";
import { getTemplateConfig } from "./ppt-template-config";

describe("isGroupHeaderLine — detects standalone sub-section labels", () => {
  it("matches short, unpunctuated, capitalised labels", () => {
    expect(isGroupHeaderLine("Higher Achievers task")).toBe(true);
    expect(isGroupHeaderLine("Middle Achievers task")).toBe(true);
    expect(isGroupHeaderLine("Lower Achievers task")).toBe(true);
  });

  it("does not match real instructions (sentence punctuation, too long, lowercase-led)", () => {
    expect(isGroupHeaderLine("Solve the equation for x.")).toBe(false);
    expect(isGroupHeaderLine("write down everything you already know about the topic")).toBe(false);
    expect(isGroupHeaderLine("A very long line that goes on and on well past the header length cap for sure")).toBe(false);
  });

  it("does not match an inline 'Label: text' lead-in line", () => {
    expect(isGroupHeaderLine("Step 1: Write the equation in standard form")).toBe(false);
  });
});

describe("splitLeadIn — detects inline 'Label: rest' rows", () => {
  it("splits a labelled line into label + rest", () => {
    expect(splitLeadIn("Step 1 (2 minutes): Write the equation in standard form")).toEqual({
      label: "Step 1 (2 minutes)",
      rest: "Write the equation in standard form",
    });
  });

  it("returns no label for a plain sentence", () => {
    expect(splitLeadIn("Write the equation in standard form.")).toEqual({
      label: null,
      rest: "Write the equation in standard form.",
    });
  });
});

// ─── drawBulletBlock rendering contract ─────────────────────────────────────────────────
//
// A minimal fake `Slide` that just records every addShape/addText call so we can assert on
// what actually got drawn, without needing a real PptxGenJS document/file round-trip.

type Call = { fn: "addShape" | "addText"; args: unknown[] };

function fakeSlide(): { slide: PptxGenJS.Slide; calls: Call[] } {
  const calls: Call[] = [];
  const slide = {
    addShape: vi.fn((...args: unknown[]) => calls.push({ fn: "addShape", args })),
    addText: vi.fn((...args: unknown[]) => calls.push({ fn: "addText", args })),
  };
  return { slide: slide as unknown as PptxGenJS.Slide, calls };
}

const pptx = new PptxGenJS();
const tpl = getTemplateConfig("classic");

describe("drawBulletBlock — sub-heading rows read as headings, not bullets", () => {
  it("draws a standalone group-header line with no marker shape and no underline/rule shape", () => {
    const { slide, calls } = fakeSlide();
    drawBulletBlock(pptx, slide, {
      x: 0, y: 0, w: 5, lines: ["Higher Achievers task"], tpl, variant: "activity", cpl: 60,
    });

    // No ellipse/roundRect marker, and critically no "line" shape (the old underline) —
    // a lone group-header row draws text only.
    const shapeCalls = calls.filter((c) => c.fn === "addShape");
    expect(shapeCalls.length).toBe(0);

    const textCalls = calls.filter((c) => c.fn === "addText");
    expect(textCalls.length).toBe(1);
    const [, textOpts] = textCalls[0]!.args as [unknown, { bold?: boolean }];
    expect(textOpts.bold).toBe(true);
  });

  it("draws a normal activity-variant instruction with its accent marker", () => {
    const { slide, calls } = fakeSlide();
    drawBulletBlock(pptx, slide, {
      x: 0, y: 0, w: 5, lines: ["Complete the worksheet by Friday."], tpl, variant: "activity", cpl: 60,
    });
    const shapeCalls = calls.filter((c) => c.fn === "addShape");
    expect(shapeCalls.length).toBe(1); // the square accent marker
  });

  it("suppresses the marker for an inline lead-in label row in the activity variant", () => {
    const { slide, calls } = fakeSlide();
    drawBulletBlock(pptx, slide, {
      x: 0, y: 0, w: 5,
      lines: ["Step 1 (2 minutes): Write the equation in standard form"],
      tpl, variant: "activity", cpl: 60,
    });
    const shapeCalls = calls.filter((c) => c.fn === "addShape");
    expect(shapeCalls.length).toBe(0);
  });

  it("suppresses the marker for an inline lead-in label row in the plain bullet variant", () => {
    const { slide, calls } = fakeSlide();
    drawBulletBlock(pptx, slide, {
      x: 0, y: 0, w: 5,
      lines: ["Higher Achievers: analyse and extend the task"],
      tpl, variant: "bullet", cpl: 60,
    });
    const shapeCalls = calls.filter((c) => c.fn === "addShape");
    expect(shapeCalls.length).toBe(0);
  });

  it("keeps the checkbox marker for a lead-in label row in the checklist variant", () => {
    const { slide, calls } = fakeSlide();
    drawBulletBlock(pptx, slide, {
      x: 0, y: 0, w: 5,
      lines: ["Knowledge: identify the standard form"],
      tpl, variant: "checklist", cpl: 60,
    });
    const shapeCalls = calls.filter((c) => c.fn === "addShape");
    // Checklist rows always draw their row background + checkbox circle regardless of label.
    expect(shapeCalls.length).toBeGreaterThan(0);
  });
});
