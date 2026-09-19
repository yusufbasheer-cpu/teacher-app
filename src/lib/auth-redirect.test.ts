import { describe, expect, it } from "vitest";
import { getOnboardingDestination, getSafeAuthNext } from "./auth-redirect";

describe("post-auth navigation", () => {
  it("preserves a requested pricing checkout and school registration", () => {
    expect(getSafeAuthNext("/pricing?checkout=pro#plans")).toBe("/pricing?checkout=pro#plans");
    expect(getSafeAuthNext("/school-register?step=2")).toBe("/school-register?step=2");
  });

  it.each([undefined, "https://evil.example", "//evil.example", "/\\evil.example", "/\tevil.example", "/login", "/auth/callback", "/onboarding?next=/login"])("rejects external or looping destinations: %s", (value) => {
    expect(getSafeAuthNext(value)).toBe("/overview");
  });

  it("carries the destination through required profile setup", () => {
    expect(getOnboardingDestination("/pricing?checkout=pro")).toBe("/onboarding?next=%2Fpricing%3Fcheckout%3Dpro");
    expect(getOnboardingDestination("/overview")).toBe("/onboarding");
  });
});
