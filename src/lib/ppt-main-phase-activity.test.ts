import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  instructionSlideLines,
  parseMainPhaseActivities,
  validateMainPhaseActivity,
  type MainPhaseActivityInstruction,
} from "./ppt-main-phase-activity";
import { buildCanonicalSlides } from "./gamma/payload";
import { buildPptxFromTemplateEngine } from "./ppt-template-engine";
import { STRUCTURED_LESSON_DECK_SLIDE_COUNT, type StructuredLessonSlideModel } from "./ppt-structured-lesson";
import { assembleFullPptFromSlideBodies, parseMainPhaseActivitiesFromPptOutline } from "./ppt-slide-by-slide";
import {
  buildRequiredVisualIntents,
  verifyRequiredVisualCoverage,
} from "./ppt-visual-intent";

function activity(name: string, id = name.toLowerCase().replace(/[^a-z]+/g, "-"), content = `${name} task about honesty and trustworthiness.`): MainPhaseActivityInstruction {
  return {
    activityId: id,
    activityName: name,
    activityGoal: "learn and teach ways to practise honesty",
    studentInstructions: [
      "Join your home group and listen to your teacher.",
      "Take a number to find your expert group.",
      "Read your group's honesty situation and discuss it together.",
      "Return to your home group and teach your example.",
      "Listen to others and write two ways to practise honesty.",
    ],
    durationMinutes: 10,
    groupSize: "4",
    studentRole: "Expert and teacher",
    requiredMaterials: ["situation cards", "notebook"],
    expectedOutput: "two written ways to practise honesty",
    teacherNotes: "Prepare mixed home groups and expert cards. Allow 3 minutes for experts and 5 minutes for home-group teaching. Monitor explanations, support readers with paired text, signal the transition, and check two written examples before moving on.",
    activityContent: content,
    activityType: "collaborative",
    parentElementId: "main-phase",
  };
}

function deck(activities: MainPhaseActivityInstruction[] = [activity("Jigsaw")]): StructuredLessonSlideModel[] {
  return Array.from({ length: STRUCTURED_LESSON_DECK_SLIDE_COUNT }, (_, index) => ({
    slideTitle: index === 5 ? "Main Phase Core Teaching" : index === 12 ? "Lesson Takeaway" : `Slide ${index + 1}`,
    body: index === 5 ? activities.map((item) => item.activityContent).join("\n\n") : `Content for logical slide ${index + 1}`,
    speakerNotes: `Teacher note ${index + 1}`,
    includeImageSlot: [0, 1, 2, 5, 7, 12].includes(index),
    ...(index === 5 ? { mainPhaseActivities: activities } : {}),
  }));
}

describe("main-phase activity instruction metadata", () => {
  it.each([
    "Learning Stations",
    "Jigsaw",
    "Think–Pair–Share",
    "Gallery Walk",
    "Debate",
    "Role Play",
    "Group Investigations",
    "Collaborative Task",
    "Supported Activity",
  ])("accepts valid instructions for %s without hardcoding its type", (name) => {
    const parsed = parseMainPhaseActivities([activity(name)]);
    expect(parsed).toHaveLength(1);
    expect(validateMainPhaseActivity(parsed[0]!)).toEqual([]);
  });

  it("renders the Grade 7 Islamic Education Jigsaw fixture with bounded student steps", () => {
    const fixture = activity("Jigsaw", "mn-jigsaw");
    const lines = instructionSlideLines(fixture);
    expect(lines[0]).toContain("learn and teach ways to practise honesty");
    expect(lines.filter((line) => /^\d+\./.test(line))).toHaveLength(5);
    expect(fixture.studentInstructions.every((step) => step.split(/\s+/).length <= 15)).toBe(true);
    expect(lines).toContain("Time: 10 min | Group size: 4 | Your role: Expert and teacher");
    expect(lines.join(" ")).not.toContain("Monitor");
  });

  it("rejects unknown malformed activity data instead of silently emitting weak instructions", () => {
    expect(parseMainPhaseActivities([{ activity_id: "fallback", activity_name: "Fallback", student_instructions: ["Do it."], activity_content: "Task" }])).toEqual([]);
  });

  it("stores activity instructions as private metadata without increasing the 13-body outline", () => {
    const fixture = activity("Jigsaw", "mn-jigsaw");
    const outline = assembleFullPptFromSlideBodies(Array.from({ length: 13 }, (_, i) => `Body ${i + 1}`), false, false, [], [fixture]);
    expect(parseMainPhaseActivitiesFromPptOutline(outline)).toEqual([fixture]);
    expect(outline.match(/^Main Phase Core Teaching$/gm)).toHaveLength(1);
  });
});

describe("physical instruction → activity ordering", () => {
  it("keeps 13 logical elements while expanding multiple activities into separate Gamma cards", () => {
    const activities = [activity("Jigsaw", "jigsaw", "Jigsaw content"), activity("Gallery Walk", "gallery", "Gallery content")];
    const logical = deck(activities);
    const physical = buildCanonicalSlides({ deck: logical });
    expect(logical).toHaveLength(13);
    const main = physical.filter((slide) => slide.deckIdx === 5);
    expect(main.map((slide) => slide.title)).toEqual([
      "How to do: Jigsaw",
      "Main Phase Core Teaching",
      "How to do: Gallery Walk",
      "Main Phase Core Teaching",
    ]);
    expect(main[1]!.lines.join(" ")).toContain("Jigsaw content");
    expect(main[3]!.lines.join(" ")).toContain("Gallery content");
  });

  it("does not duplicate instructions when long activity content overflows", () => {
    const long = Array.from({ length: 80 }, (_, index) => `Explain honesty example ${index + 1} with evidence from the scenario.`).join("\n");
    const physical = buildCanonicalSlides({ deck: deck([activity("Jigsaw", "jigsaw", long)]) });
    const main = physical.filter((slide) => slide.deckIdx === 5);
    expect(main.filter((slide) => slide.physicalKind === "activity-instructions")).toHaveLength(1);
    expect(main.filter((slide) => slide.physicalKind === "content").length).toBeGreaterThan(1);
    expect(main[0]!.title).toBe("How to do: Jigsaw");
  });

  it("writes instruction teacher guidance to real legacy PowerPoint speaker notes", async () => {
    const buffer = await buildPptxFromTemplateEngine({
      templateId: "gamma",
      slides: deck(),
      subject: "Islamic Education",
      grade: "Grade 7",
      topic: "Honesty and Trustworthiness in Everyday Life",
    });
    const zip = await JSZip.loadAsync(buffer);
    const notes = await Promise.all(Object.keys(zip.files).filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name)).map((name) => zip.file(name)!.async("string")));
    expect(notes.join("\n")).toContain("Prepare mixed home groups and expert cards");
  }, 30_000);
});

describe("required visual coverage", () => {
  it("tracks exactly the six required logical categories", () => {
    const intents = buildRequiredVisualIntents({ deck: deck(), topic: "Photosynthesis", subject: "Science", grade: "Grade 6" });
    expect(intents.map((item) => item.category)).toEqual(["cover", "starter", "topic", "main-phase", "uae-connection", "takeaway"]);
  });

  it("does not treat unproven theme pictures as semantically verified", () => {
    const logical = deck();
    const physical = buildCanonicalSlides({ deck: logical });
    const intents = buildRequiredVisualIntents({ deck: logical, topic: "Photosynthesis", subject: "Science", grade: "Grade 6" });
    const report = verifyRequiredVisualCoverage({ intents, physicalSlides: physical, actualSlides: physical.map(() => ({ pictures: 1 })) });
    expect(report.verdict).toBe("uncertain");
    expect(report.categories.every((item) => item.status === "unverified")).toBe(true);
  });

  it("reports a missing category independently from content preservation", () => {
    const logical = deck();
    const physical = buildCanonicalSlides({ deck: logical });
    const intents = buildRequiredVisualIntents({ deck: logical, topic: "Photosynthesis", subject: "Science", grade: "Grade 6" })
      .map((intent) => ({ ...intent, imageSource: "fal" as const, assetStatus: "resolved" as const, resolvedImageReference: `asset-${intent.category}` }));
    const actual = physical.map((slide) => ({ pictures: slide.deckIdx === 12 ? 0 : 1 }));
    const report = verifyRequiredVisualCoverage({ intents, physicalSlides: physical, actualSlides: actual });
    expect(report.verdict).toBe("failed");
    expect(report.categories.find((item) => item.category === "takeaway")?.status).toBe("missing");
  });
});
