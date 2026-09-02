import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { buildLessonParams, firstName, greeting, relativeDay } from "./workspace-helpers";

function mockUser(fullName: string | undefined): User {
  return { user_metadata: { full_name: fullName } } as unknown as User;
}

describe("greeting", () => {
  it("says Good morning before noon", () => {
    expect(greeting(new Date(2026, 0, 1, 0))).toBe("Good morning");
    expect(greeting(new Date(2026, 0, 1, 11, 59))).toBe("Good morning");
  });

  it("says Good afternoon from noon up to 5pm", () => {
    expect(greeting(new Date(2026, 0, 1, 12))).toBe("Good afternoon");
    expect(greeting(new Date(2026, 0, 1, 16, 59))).toBe("Good afternoon");
  });

  it("says Good evening from 5pm onward", () => {
    expect(greeting(new Date(2026, 0, 1, 17))).toBe("Good evening");
    expect(greeting(new Date(2026, 0, 1, 23, 59))).toBe("Good evening");
  });
});

describe("firstName", () => {
  it("takes the first word of the user's full name", () => {
    expect(firstName(mockUser("Uvais Solanki"))).toBe("Uvais");
  });

  it("trims surrounding whitespace before splitting", () => {
    expect(firstName(mockUser("  Uvais Solanki  "))).toBe("Uvais");
  });

  it("falls back to null when full_name is missing or blank, rather than inventing a name", () => {
    expect(firstName(mockUser(undefined))).toBeNull();
    expect(firstName(mockUser("   "))).toBeNull();
  });
});

describe("relativeDay", () => {
  it("labels the current day as Today", () => {
    expect(relativeDay(new Date().toISOString())).toBe("Today");
  });

  it("labels exactly one day ago as Yesterday", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    expect(relativeDay(yesterday)).toBe("Yesterday");
  });

  it("counts days for anything under a week old", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    expect(relativeDay(threeDaysAgo)).toBe("3 days ago");
  });

  it("falls back to an absolute short date at a week or older", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
    const result = relativeDay(tenDaysAgo.toISOString());
    expect(result).not.toMatch(/days ago|Today|Yesterday/);
  });
});

describe("buildLessonParams", () => {
  const base = { curriculum: "CBSE/NCERT", grade: "Grade 8", subject: "Math", chapter: "" };

  it("carries curriculum, grade, and subject", () => {
    const params = new URLSearchParams(buildLessonParams(base));
    expect(params.get("curriculumType")).toBe("CBSE/NCERT");
    expect(params.get("grade")).toBe("Grade 8");
    expect(params.get("subject")).toBe("Math");
  });

  it("omits chapter entirely when blank, rather than sending an empty param", () => {
    const params = new URLSearchParams(buildLessonParams(base));
    expect(params.has("chapter")).toBe(false);
  });

  it("includes a trimmed chapter when present", () => {
    const params = new URLSearchParams(
      buildLessonParams({ ...base, chapter: "  Photosynthesis  " }),
    );
    expect(params.get("chapter")).toBe("Photosynthesis");
  });

  it("lets extra params override the base fields, for callers like the quick-action links", () => {
    const params = new URLSearchParams(buildLessonParams(base, { subject: "Science" }));
    expect(params.get("subject")).toBe("Science");
  });
});
