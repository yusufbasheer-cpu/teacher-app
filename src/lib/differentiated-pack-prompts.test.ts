import { describe, expect, it } from "vitest";
import { buildDiffPackLevelSystemPrompt } from "./differentiated-pack-prompts";

describe("buildDiffPackLevelSystemPrompt curriculum semantics", () => {
  it("CASE A — no framework selected injects no curriculum claims into every worksheet", () => {
    for (const level of ["foundation", "core", "extension"] as const) {
      const prompt = buildDiffPackLevelSystemPrompt(level);
      expect(prompt.toLowerCase()).not.toContain("uae");
      expect(prompt.toLowerCase()).not.toContain("khda");
      expect(prompt.toLowerCase()).not.toContain("curriculum alignment:");
    }
  });

  it("CASE B — selecting a framework threads its guidance into the system prompt", () => {
    const prompt = buildDiffPackLevelSystemPrompt("foundation", "uae_moe_khda_spea");
    expect(prompt).toContain("MOE, KHDA, SPEA");
  });

  it("selecting a non-UAE framework never pulls in UAE-specific language", () => {
    const prompt = buildDiffPackLevelSystemPrompt("core", "uk_ofsted");
    expect(prompt).toContain("Ofsted");
    expect(prompt.toLowerCase()).not.toContain("khda");
    expect(prompt.toLowerCase()).not.toContain("uae moe");
  });

  it("does not force a fixed 'Curriculum alignment: ...' worksheet opener regardless of selection", () => {
    for (const framework of [undefined, "", "uae_moe_khda_spea", "india_cbse_nep"]) {
      const prompt = buildDiffPackLevelSystemPrompt("extension", framework);
      expect(prompt).not.toContain("Worksheet must start with");
    }
  });
});
