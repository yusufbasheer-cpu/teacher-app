import { describe, expect, it } from "vitest";
import { validateGeneratedSlideBody } from "./ppt-semantic-quality";

describe("PPT semantic quality validation", () => {
  it.each([
    ["Science", "The Water Cycle", "Explain how water particles gain energy during evaporation and lose energy during condensation."],
    ["Mathematics", "Linear Equations", "Solve 3x + 5 = 20, show each inverse operation, then substitute x to check the result."],
    ["History", "The Industrial Revolution", "Compare factory and domestic work using two sources, then explain one cause of urban growth."],
  ])("accepts topic-specific core teaching for %s", (_subject, topic, body) => {
    expect(validateGeneratedSlideBody("Main Phase Core Teaching", `${body}\n${body}`, topic).filter((issue) => issue.severity === "error")).toEqual([]);
  });
  it("rejects known placeholders and empty assessment shells", () => {
    expect(validateGeneratedSlideBody("Main Phase Core Teaching", "Key concepts, terms, and explanations for today's lesson, followed by guided practice activities to apply what students have learned.", "Water Cycle")).toEqual(expect.arrayContaining([expect.objectContaining({ code: "generic_placeholder" })]));
    expect(validateGeneratedSlideBody("Exit Ticket", "A short question to check your understanding before you leave today's lesson.", "Water Cycle")).toEqual(expect.arrayContaining([expect.objectContaining({ code: "exit_ticket_question_count" })]));
  });
  it("accepts two or three concrete exit questions", () => {
    const body = "1. What change of state turns liquid water into water vapour?\n2. Explain why droplets form on a cold bottle?\n3. Predict how stronger heating changes evaporation?";
    expect(validateGeneratedSlideBody("Exit Ticket", body, "Water Cycle").filter((issue) => issue.severity === "error")).toEqual([]);
  });
  it("requires measurable criteria without depending on one subject vocabulary", () => {
    const good = ["I can identify two causes.", "I can compare two sources.", "I can explain one consequence.", "I can justify a conclusion with evidence."].join("\n");
    expect(validateGeneratedSlideBody("Success Criteria and Self Evaluation", good, "Industrial Revolution").filter((issue) => issue.severity === "error")).toEqual([]);
    expect(validateGeneratedSlideBody("Success Criteria and Self Evaluation", "I can understand the topic.", "Industrial Revolution")).toEqual(expect.arrayContaining([expect.objectContaining({ code: "success_criteria_structure" })]));
  });
});
