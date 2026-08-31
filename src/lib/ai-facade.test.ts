import { describe, expect, it, vi } from "vitest";

const callDeepSeekChatImpl = vi.hoisted(() => vi.fn());
const generateFluxSectionImagesImpl = vi.hoisted(() => vi.fn());
const generateLessonPptFluxImageDedupedImpl = vi.hoisted(() => vi.fn());
const generateFalPptImageFromPromptImpl = vi.hoisted(() => vi.fn());
const fetchPexelsImageImpl = vi.hoisted(() => vi.fn());
const fetchPexelsUniqueLandscapeUrlImpl = vi.hoisted(() => vi.fn());
const fetchPptPexelsImagesImpl = vi.hoisted(() => vi.fn());

vi.mock("@/lib/question-paper-deepseek", () => ({
  callDeepSeekChat: callDeepSeekChatImpl,
  deepSeekHttpErrorMessage: vi.fn(),
  getDeepSeekApiKey: vi.fn(),
}));

vi.mock("@/lib/fal-flux-section-images", () => ({
  generateFluxSectionImages: generateFluxSectionImagesImpl,
  FAL_BALANCE_EXHAUSTED_USER_MESSAGE: "locked",
  FAL_FLUX_MODEL_ID: "fal-ai/flux-1/dev",
  formatFalError: vi.fn(),
  getFalCredentials: vi.fn(),
  isFalAccountLockedError: vi.fn(),
}));

vi.mock("@/lib/fal-ppt-slide-images", () => ({
  generateFalPptImageFromPrompt: generateFalPptImageFromPromptImpl,
  generateLessonPptFluxImageDeduped: generateLessonPptFluxImageDedupedImpl,
  getFalPptCircuitOpenReason: vi.fn(),
  resetFalPptCircuitForTests: vi.fn(),
}));

vi.mock("@/lib/pexels-images", () => ({
  buildPexelsQuery: vi.fn(),
  fetchPexelsImage: fetchPexelsImageImpl,
  fetchPexelsUniqueLandscapeUrl: fetchPexelsUniqueLandscapeUrlImpl,
  fetchPptPexelsImages: fetchPptPexelsImagesImpl,
  PPT_IMAGE_SLIDE_INDICES: { title: 0 },
}));

import {
  callDeepSeekChat,
  fetchPexelsImage,
  fetchPexelsUniqueLandscapeUrl,
  fetchPptPexelsImages,
  generateFalPptImageFromPrompt,
  generateFluxSectionImages,
  generateLessonPptFluxImageDeduped,
} from "./ai-facade";

describe("ai-facade", () => {
  it("passes DeepSeek calls through unchanged", async () => {
    callDeepSeekChatImpl.mockResolvedValue({ content: "ok" });
    const params = {
      logLabel: "q1",
      systemPrompt: "system",
      userMessage: "user",
      maxTokens: 123,
      temperature: 0.5,
    };

    await expect(callDeepSeekChat(params)).resolves.toEqual({ content: "ok" });
    expect(callDeepSeekChatImpl).toHaveBeenCalledWith(params);
  });

  it("passes fal section image generation through unchanged", async () => {
    generateFluxSectionImagesImpl.mockResolvedValue({ sectionImages: { a: ["x"] }, errors: {} });
    const params = {
      input: { curriculumType: "CBSE/NCERT", curriculumFramework: "", grade: "Grade 3", subject: "Math", chapter: "", topic: "", learningObjectives: "" },
      plan: { "Full Lesson Plan": "Plan" },
      sections: ["Full Lesson Plan"] as const,
    };

    await expect(generateFluxSectionImages(params)).resolves.toEqual({ sectionImages: { a: ["x"] }, errors: {} });
    expect(generateFluxSectionImagesImpl).toHaveBeenCalledWith(params);
  });

  it("passes fal PPT image calls through unchanged", async () => {
    generateLessonPptFluxImageDedupedImpl.mockResolvedValue("https://example.com/fal.png");
    const params = [{ subject: "Math", grade: "Grade 3", topic: "Fractions" }, "sdg_chapter", new Set<string>(), { logLabel: "slide-3" }] as const;

    await expect(generateLessonPptFluxImageDeduped(...params)).resolves.toBe("https://example.com/fal.png");
    expect(generateLessonPptFluxImageDedupedImpl).toHaveBeenCalledWith(...params);
  });

  it("passes the direct fal PPT prompt helper through unchanged", async () => {
    generateFalPptImageFromPromptImpl.mockResolvedValue("https://example.com/fal-ppt.png");

    await expect(generateFalPptImageFromPrompt("prompt", { logLabel: "ppt" })).resolves.toBe(
      "https://example.com/fal-ppt.png",
    );
    expect(generateFalPptImageFromPromptImpl).toHaveBeenCalledWith("prompt", { logLabel: "ppt" });
  });

  it("passes Pexels helpers through unchanged", async () => {
    fetchPexelsImageImpl.mockResolvedValue("https://example.com/pexels.jpg");
    fetchPexelsUniqueLandscapeUrlImpl.mockResolvedValue("https://example.com/pexels-unique.jpg");
    fetchPptPexelsImagesImpl.mockResolvedValue(["https://example.com/deck.jpg"]);

    await expect(fetchPexelsImage("topic art")).resolves.toBe("https://example.com/pexels.jpg");
    await expect(fetchPexelsUniqueLandscapeUrl("topic art", new Set(), { logLabel: "slot" })).resolves.toBe(
      "https://example.com/pexels-unique.jpg",
    );
    await expect(fetchPptPexelsImages("topic", "subject", 1)).resolves.toEqual(["https://example.com/deck.jpg"]);
  });
});
