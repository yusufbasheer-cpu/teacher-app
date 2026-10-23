import { describe, expect, it } from "vitest";
import { curateGammaThemes, listGammaThemes, validateGammaPresentationOptions, type GammaTheme } from "./themes";

const themes: GammaTheme[] = [
  { id: "clean", name: "Boardroom", type: "standard", colorKeywords: ["blue", "white"], toneKeywords: ["professional", "clean"] },
  { id: "fresh", name: "Notebook", type: "standard", colorKeywords: ["green"], toneKeywords: ["modern", "educational"] },
  { id: "bold", name: "Pop", type: "standard", colorKeywords: ["colorful"], toneKeywords: ["vibrant", "playful"] },
  { id: "plain", name: "Aaa", type: "standard", colorKeywords: [], toneKeywords: [] },
  { id: "school", name: "Our School", type: "custom", colorKeywords: ["navy", "gold"], toneKeywords: [] },
];

describe("Gamma theme presentation", () => {
  it("offers every theme, workspace themes first, classroom-suited ones ahead of plain ones", () => {
    const result = curateGammaThemes(themes);
    expect(result).toHaveLength(5);
    expect(result[0]!.id).toBe("school");
    expect(result.at(-1)!.id).toBe("plain");
  });
  it("derives preview colours from Gamma's colour keywords only", () => {
    const result = curateGammaThemes(themes);
    expect(result.find((t) => t.id === "clean")!.swatch).toEqual(["#3b6fd8", "#ffffff"]);
    expect(result.find((t) => t.id === "plain")!.swatch).toEqual([]);
  });
  it("accepts only server-listed themes and truthful image options", () => {
    expect(validateGammaPresentationOptions({ themeId: "fresh", imageSource: "pexels", imageStyle: "ignored" }, themes)).toEqual({ themeId: "fresh", imageSource: "pexels", imageStyle: undefined });
    expect(() => validateGammaPresentationOptions({ themeId: "not-real" }, themes)).toThrow(/not available/);
  });
  it("requests at most Gamma's documented page size and follows nextCursor", async () => {
    const urls: string[] = [];
    const fetchImpl = (async (input: URL) => {
      urls.push(String(input));
      const type = input.searchParams.get("type");
      const after = input.searchParams.get("after");
      const body = type === "custom" ? { data: [], hasMore: false, nextCursor: null }
        : after ? { data: [{ id: "b", name: "B", type: "standard" }], hasMore: false, nextCursor: null }
        : { data: [{ id: "a", name: "A", type: "standard" }], hasMore: true, nextCursor: "c1" };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const list = await listGammaThemes({ apiKey: "k", baseUrl: "https://gamma.test/v-page", requestTimeoutMs: 1000 }, fetchImpl);
    expect(list.map((t) => t.id)).toEqual(["a", "b"]);
    expect(urls.every((u) => Number(new URL(u).searchParams.get("limit")) <= 50)).toBe(true);
  });
});
