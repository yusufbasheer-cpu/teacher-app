import { describe, it, expect } from "vitest";
import { assembleFullPptFromSlideBodies, parseDeckBodiesFromPptOutline } from "./ppt-slide-by-slide";
import { buildStructuredLessonSlides, type StructuredLessonPptContext } from "./ppt-structured-lesson";

/**
 * Regression coverage for a bug where slide 8's exported body was silently replaced with
 * slide 6's content (including its "I Do — Teacher Explanation" header). Root cause: when
 * only "PPT Slide Content" is generated (no separate "Full Lesson Plan"), the frontend sends
 * a combined multi-section document as `fullLessonPlan`. `pickDeck`/`pickNonUaeSlide8`/
 * `pickUaeFrameworkSlide8` used to run a loose heading-line keyword search over that whole
 * document as a secondary source and *merge* it on top of the already-correct, isolated
 * per-slide body — a stray keyword match inside one slide's prose (e.g. "SDG Goal: ..."
 * inside slide 3 satisfying the "global" link's "sdg" hint) could capture a span running
 * through several unrelated slides. The fix makes the isolated per-slide body authoritative
 * whenever it exists, skipping that secondary search entirely in that case.
 */

function baseBodies(): string[] {
  const bodies: string[] = new Array(13).fill("");
  bodies[0] = "Grade 8\n1 September 2026";
  bodies[1] = "Starter: think about the Industrial Revolution. Share one idea with a partner.";
  bodies[2] =
    "Chapter: Industrial Revolution\nTopic: Causes of the Industrial Revolution\nSDG Goal: 9 - Industry, Innovation and Infrastructure";
  bodies[3] = "Students will explain the causes of the Industrial Revolution.";
  bodies[4] = "Students will be able to identify and explain the four key causes of the Industrial Revolution.";
  bodies[5] = `I Do — Teacher Explanation:
The Industrial Revolution had several key causes. The first cause is Agricultural Improvements, which increased food production. The second cause is Population Growth, which provided a larger workforce. The third cause is Access to Capital, which allowed investment in new machinery. The fourth cause is Technological Innovations, such as the steam engine and spinning jenny, which transformed manufacturing processes and increased productivity across multiple industries in Britain and beyond.

We Do — Guided Practice:
Teacher and students work through an example together, mapping each cause to its effect on factory production using a graphic organizer.

You Do — Independent Practice:
Students independently write two sentences explaining how Technological Innovations changed the way goods were manufactured during this period.`;
  bodies[6] = `Higher Achievers task
Evaluate which cause of the Industrial Revolution had the greatest long-term impact and justify your answer.

Middle Achievers task
List the four causes of the Industrial Revolution and describe one effect of each.

Lower Achievers task
Match each cause of the Industrial Revolution to its correct description using the word bank provided.

Mini Plenary
Which cause of the Industrial Revolution do you think mattered most, and why?`;
  bodies[7] = `Real-Life Application: Understanding the Industrial Revolution helps students see how factory-based mass production still shapes how goods are made and sold today, from clothing to electronics.

Cross-Curricular Link: This topic connects to Geography, since industrialisation changed the growth and layout of cities such as Manchester and Birmingham.

Career Connection: Historians, urban planners, and manufacturing engineers all draw on an understanding of industrialisation to do their work today.`;
  bodies[8] = `Rapid Recall Round
Objective: Consolidate understanding of the causes of the Industrial Revolution.
Step 1 (2 min): Teacher reads out a cause; students race to write the matching effect.
Step 2 (3 min): Pairs check answers together.
Students reflect by writing one sentence summarising what they found most surprising about the causes of the Industrial Revolution.`;
  bodies[9] = "Research one factory town from the Industrial Revolution and write a short report on its growth.";
  bodies[10] = "On your way out, name two causes of the Industrial Revolution.";
  bodies[11] = "I can explain at least two causes of the Industrial Revolution.";
  bodies[12] = "Thank you / Questions";
  return bodies;
}

const CTX_BASE: Omit<StructuredLessonPptContext, "pptContent" | "fullLessonPlan"> = {
  subject: "Social Science",
  grade: "Grade 8",
  topic: "Causes of the Industrial Revolution",
  teacherName: "Teacher",
  learningObjectivesText: "Students will explain the causes of the Industrial Revolution.",
  curriculumFramework: "",
};

/** Mirrors buildCombinedTeacherPackageTextForPpt() when only "PPT Slide Content" exists. */
function asCombinedBlob(assembled: string): string {
  return `## PPT Slide Content\n\n${assembled}`;
}

describe("PPT slide isolation — cross-slide contamination regression", () => {
  it("[case 1: unique-content-per-slide] every final slide body contains only its own distinguishing content", () => {
    const bodies = baseBodies();
    const assembled = assembleFullPptFromSlideBodies(bodies, false, false);
    const slides = buildStructuredLessonSlides({
      ...CTX_BASE,
      fullLessonPlan: asCombinedBlob(assembled),
      pptContent: assembled,
    });

    expect(slides[5]!.body).toContain("Technological Innovations");
    expect(slides[5]!.body).toContain("I Do");

    // Slide 8 must carry its own real-life/cross-curricular content and none of slide 6's
    // "I Do / We Do / You Do" structure or distinguishing phrases.
    expect(slides[7]!.body).toContain("Cross-Curricular Link");
    expect(slides[7]!.body).not.toContain("I Do");
    expect(slides[7]!.body).not.toContain("We Do");
    expect(slides[7]!.body).not.toContain("You Do");
    expect(slides[7]!.body).not.toContain("Technological Innovations");
    expect(slides[7]!.body).not.toContain("Higher Achievers");

    // Slide 7 (differentiated) must not carry slide 6 or slide 8 content either.
    expect(slides[6]!.body).not.toContain("Technological Innovations");
    expect(slides[6]!.body).not.toContain("Cross-Curricular Link");
  });

  it("[case 2: title-inside-body] a slide legitimately mentioning another slide's title as prose does not break isolation", () => {
    const bodies = baseBodies();
    // Slide 6 body mentions "real life" and "career" in ordinary prose (not as a standalone
    // heading line) — this must not be mistaken for slide 8's title/content.
    bodies[5] = `${bodies[5]}\n\nThis has real life relevance and connects to future careers in engineering.`;
    const assembled = assembleFullPptFromSlideBodies(bodies, false, false);
    const slides = buildStructuredLessonSlides({
      ...CTX_BASE,
      fullLessonPlan: asCombinedBlob(assembled),
      pptContent: assembled,
    });

    expect(slides[5]!.body).toContain("real life relevance");
    expect(slides[7]!.body).not.toContain("Technological Innovations");
    expect(slides[7]!.body).not.toContain("real life relevance");
  });

  it("[case 3: repeated-title-text] a phrase shared with slide 8's title recurring elsewhere still resolves each slide independently", () => {
    const bodies = baseBodies();
    bodies[8] = `${bodies[8]}\n\nThis plenary also references real life and cross curricular ideas informally.`;
    const assembled = assembleFullPptFromSlideBodies(bodies, false, false);
    const slides = buildStructuredLessonSlides({
      ...CTX_BASE,
      fullLessonPlan: asCombinedBlob(assembled),
      pptContent: assembled,
    });

    expect(slides[7]!.body).toContain("Cross-Curricular Link");
    expect(slides[7]!.body).not.toContain("Rapid Recall Round");
    expect(slides[8]!.body).toContain("Rapid Recall Round");
  });

  it("[case 4: missing-section] a failed slide generation shows an explicit placeholder, never a neighboring slide's content", () => {
    const bodies = baseBodies();
    bodies[7] = "_(Real Life and Cross Curricular Connection could not be generated — please regenerate this slide.)_";
    const assembled = assembleFullPptFromSlideBodies(bodies, false, false);
    const slides = buildStructuredLessonSlides({
      ...CTX_BASE,
      fullLessonPlan: asCombinedBlob(assembled),
      pptContent: assembled,
    });

    // Must not silently inherit slide 6/7's content — either the placeholder text or a
    // generic non-slide-6/7 fallback template, but never another slide's real content.
    expect(slides[7]!.body).not.toContain("I Do");
    expect(slides[7]!.body).not.toContain("Technological Innovations");
    expect(slides[7]!.body).not.toContain("Higher Achievers");
    expect(slides[5]!.body).toContain("Technological Innovations");
  });

  it("[case 5: truncated-section] slide 6 cut off mid-sentence (token-limit style truncation) does not bleed into slide 7 or 8", () => {
    const bodies = baseBodies();
    bodies[5] = `I Do — Teacher Explanation:
The Industrial Revolution had several key causes. The first cause is Agricultural Improvements, which increased food production. The second cause is Population Growth, which provided a larger workforce, and the third cause is Access to Capital, which allowed investment in new machin`; // cut off mid-word, no closing punctuation, no We Do / You Do sections
    const assembled = assembleFullPptFromSlideBodies(bodies, false, false);
    const parsed = parseDeckBodiesFromPptOutline(assembled, false, false);
    expect(parsed).not.toBeNull();
    // Slide 7's boundary must still be found even though slide 6 never reached a natural end.
    expect(parsed![6]).toContain("Higher Achievers");
    expect(parsed![6]).not.toContain("Access to Capital");

    const slides = buildStructuredLessonSlides({
      ...CTX_BASE,
      fullLessonPlan: asCombinedBlob(assembled),
      pptContent: assembled,
    });
    expect(slides[6]!.body).not.toContain("Access to Capital");
    expect(slides[7]!.body).not.toContain("Access to Capital");
    expect(slides[7]!.body).toContain("Cross-Curricular Link");
  });

  it("[case 6: continuation-slides] an unusually long slide 6 body (near the per-slide clamp) still isolates slide 7 and 8 correctly", () => {
    const bodies = baseBodies();
    const longParagraphs = Array.from(
      { length: 30 },
      (_, i) =>
        `Paragraph ${i + 1}: the Industrial Revolution reshaped manufacturing through sustained investment in machinery, labour, and capital across many linked industries.`,
    ).join("\n\n");
    bodies[5] = `I Do — Teacher Explanation:\n${longParagraphs}\n\nWe Do — Guided Practice:\nGuided example.\n\nYou Do — Independent Practice:\nIndependent task.`;
    const assembled = assembleFullPptFromSlideBodies(bodies, false, false);
    const slides = buildStructuredLessonSlides({
      ...CTX_BASE,
      fullLessonPlan: asCombinedBlob(assembled),
      pptContent: assembled,
    });

    expect(slides[6]!.body).not.toContain("Paragraph 1:");
    expect(slides[7]!.body).not.toContain("Paragraph 1:");
    expect(slides[7]!.body).toContain("Cross-Curricular Link");
  });

  it("[case 7: full-deck-mapping] all 13 slides map to distinct, non-crossed content across the whole deck", () => {
    const bodies = baseBodies();
    const assembled = assembleFullPptFromSlideBodies(bodies, false, false);
    const slides = buildStructuredLessonSlides({
      ...CTX_BASE,
      fullLessonPlan: asCombinedBlob(assembled),
      pptContent: assembled,
    });

    expect(slides).toHaveLength(13);
    const fingerprints = [
      /Grade 8/,
      /Starter:/,
      /SDG Goal: 9/,
      /explain the causes/,
      /identify and explain/,
      /Technological Innovations/,
      /Higher Achievers/,
      /Cross-Curricular Link/,
      /Rapid Recall Round/,
      /Research one factory town/,
      /name two causes/,
      /I can explain at least two causes/,
      /Thank you/,
    ];
    slides.forEach((slide, i) => {
      expect(slide.body, `slide ${i + 1} should contain its own fingerprint`).toMatch(fingerprints[i]!);
      fingerprints.forEach((fp, j) => {
        if (j === i) return;
        expect(slide.body, `slide ${i + 1} should not contain slide ${j + 1}'s fingerprint`).not.toMatch(fp);
      });
    });
  });

  it("UAE-framework slide 8 variant is protected by the same authoritative-isolated-body rule", () => {
    const bodies = baseBodies();
    bodies[7] = `UAE Real-Life Connection: the Industrial Revolution's legacy informs UAE Vision 2071 industrial diversification.

Cross-Curricular Link: connects to Geography and Economics.

UAE MOE Alignment: supports UAE Ministry of Education curriculum goals.

SDG in UAE Context: SDG 9 — Industry, Innovation and Infrastructure.`;
    const assembled = assembleFullPptFromSlideBodies(bodies, false, true);
    const slides = buildStructuredLessonSlides({
      ...CTX_BASE,
      fullLessonPlan: asCombinedBlob(assembled),
      pptContent: assembled,
      curriculumFramework: "uae-moe",
    });

    expect(slides[7]!.body).toContain("UAE Vision 2071");
    expect(slides[7]!.body).not.toContain("I Do");
    expect(slides[7]!.body).not.toContain("Technological Innovations");
    expect(slides[7]!.body).not.toContain("Higher Achievers");
  });
});
