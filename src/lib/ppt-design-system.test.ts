import { describe, expect, it } from "vitest";
import { getPptDesignTokens, contrastRatio, mirrorRegion } from "./ppt-design-system";
import { getTemplateConfig, TEMPLATE_IDS } from "./ppt-template-config";
import { SLIDE_COMPOSITION_REGISTRY } from "./slide-composition-registry";

describe("PPT design system", () => {
  it.each(TEMPLATE_IDS)("keeps readable text contrast for the %s theme", (id) => {
    const tokens = getPptDesignTokens(getTemplateConfig(id), "en");
    expect(contrastRatio(tokens.colors.text, tokens.colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.colors.mutedText, tokens.colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.colors.accentText, tokens.colors.accent)).toBeGreaterThanOrEqual(4.5);
    expect(tokens.type.minimumBody).toBeGreaterThanOrEqual(15);
  });

  it("mirrors composition regions within the 16:9 safe canvas for Arabic", () => {
    const regions = Object.values(SLIDE_COMPOSITION_REGISTRY).flatMap((definition) => Object.values(definition.regions));
    for (const region of regions) {
      const mirrored = mirrorRegion(region, true);
      expect(mirrored.x).toBeGreaterThanOrEqual(0);
      expect(mirrored.x + mirrored.w).toBeLessThanOrEqual(13.333 + 0.001);
      expect(mirrored.y + mirrored.h).toBeLessThanOrEqual(7.5);
    }
    expect(getPptDesignTokens(getTemplateConfig("classic"), "ar").rtl).toBe(true);
  });
});
