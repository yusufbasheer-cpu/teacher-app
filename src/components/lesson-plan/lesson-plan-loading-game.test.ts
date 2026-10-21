import { describe, expect, it } from "vitest";
import { presentationStageForStatus } from "@/components/lesson-plan/lesson-plan-loading-game";

describe("presentation generation progress", () => {
  it("maps only observable backend messages to educator-facing stages", () => {
    expect(presentationStageForStatus("Initializing...")).toBe(0);
    expect(presentationStageForStatus("Generating Slide 7 of 13")).toBe(1);
    expect(presentationStageForStatus("Finding and creating presentation visuals…")).toBe(2);
    expect(presentationStageForStatus("Finalizing your lesson package…")).toBe(3);
  });
});
