import { describe, expect, it } from "vitest";
import { DEFAULT_EXPERIMENT_FEATURES, experimentFeatureForPath, isFeatureAllowed, isFeatureVisible } from "./experiment-feature-lock";

const isolated = { GAMMA_ENVIRONMENT_NAME: "staging" };

describe("experiment feature lock", () => {
  it("has no effect outside isolated environments", () => {
    expect(isFeatureAllowed("/pricing", {})).toBe(true);
    expect(isFeatureAllowed("/api/razorpay/create-order", { GAMMA_ENVIRONMENT_NAME: "production" })).toBe(true);
  });

  it("allows only the focused product by default", () => {
    for (const path of ["/", "/login", "/auth/callback", "/dashboard", "/overview", "/lesson-plan", "/api/lesson-plan", "/api/lesson-plan/export/docx", "/api/lesson-plan/export/pptx", "/api/lesson-plan/export/zip", "/my-lesson-plans/id", "/settings", "/api/account/export", "/super-admin", "/api/super-admin/stats", "/api/user-usage", "/api/environment-check"]) {
      expect(isFeatureAllowed(path, isolated), path).toBe(true);
    }
    for (const path of ["/pricing", "/question-paper", "/differentiated-worksheets", "/school-admin", "/hod-dashboard", "/landing", "/about", "/onboarding", "/api/razorpay/create-order", "/api/contact", "/api/get-image", "/api/welcome-email"]) {
      expect(isFeatureAllowed(path, isolated), path).toBe(false);
    }
  });

  it("can be widened or narrowed with named features", () => {
    const env = { ...isolated, EXPERIMENT_ALLOWED_FEATURES: "auth,question-paper" };
    expect(isFeatureAllowed("/login", env)).toBe(true);
    expect(isFeatureAllowed("/lesson-plan", env)).toBe(false);
    expect(isFeatureAllowed("question-paper", env)).toBe(true);
  });

  it("uses the public experiment flag only as a client-side visibility hint", () => {
    const client = { NEXT_PUBLIC_GAMMA_EXPERIMENT: "true" };
    expect(isFeatureVisible("/pricing", client)).toBe(false);
    expect(isFeatureAllowed("/pricing", client)).toBe(true);
  });

  it("maps query strings and dynamic paths without prefix confusion", () => {
    expect(experimentFeatureForPath("/my-lesson-plans/abc?x=1")).toBe("my-lesson-plans");
    expect(experimentFeatureForPath("/lesson-planner")).toBeNull();
    expect(DEFAULT_EXPERIMENT_FEATURES).toContain("lesson-plan-pptx");
  });
});
