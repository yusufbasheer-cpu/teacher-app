import { describe, expect, it } from "vitest";
import { resolveGenerationTopic } from "./lesson-plan";

describe("resolveGenerationTopic — fallback used inside generation prompts", () => {
  it("uses the topic verbatim when the teacher filled it in", () => {
    expect(
      resolveGenerationTopic(
        "Factors Affecting Friction and Its Everyday Applications",
        "Friction",
      ),
    ).toBe("Factors Affecting Friction and Its Everyday Applications");
  });

  it("falls back to chapter when topic is left blank (optional field)", () => {
    expect(resolveGenerationTopic("", "Friction")).toBe("Friction");
    expect(resolveGenerationTopic("   ", "Friction")).toBe("Friction");
    expect(resolveGenerationTopic(null, "Friction")).toBe("Friction");
    expect(resolveGenerationTopic(undefined, "Friction")).toBe("Friction");
  });

  it("never returns an empty focus string that a prompt could interpolate as blank, when chapter exists", () => {
    const resolved = resolveGenerationTopic("", "Friction");
    expect(resolved.trim().length).toBeGreaterThan(0);
  });

  it("returns empty string only when both topic and chapter are blank (caller must supply a further fallback)", () => {
    expect(resolveGenerationTopic("", "")).toBe("");
    expect(resolveGenerationTopic(undefined, undefined)).toBe("");
  });
});
