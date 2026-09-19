import { afterEach, describe, expect, it, vi } from "vitest";
import { renderUploadedPpt } from "./uploaded-ppt-export";

const slide = {
  slideTitle: "Learning Objectives",
  body: "Explain the water cycle.",
  speakerNotes: "Ask for examples.",
  includeImageSlot: false,
};

afterEach(() => vi.unstubAllGlobals());

describe("uploaded PowerPoint export", () => {
  it("sends the canonical slide content to the private renderer", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(new Uint8Array([80, 75, 3, 4]), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const result = await renderUploadedPpt({
      template: Buffer.from([80, 75, 3, 4]),
      slides: [slide],
      slideImageUrls: [null],
      serviceUrl: "https://ppt.example.com",
      serviceSecret: "secret",
    });
    expect(result.subarray(0, 2).toString()).toBe("PK");
    const [url, request] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ppt.example.com/render-uploaded-template");
    expect((request.headers as Record<string, string>)["X-Template-Service-Secret"]).toBe("secret");
    const form = request.body as FormData;
    expect(JSON.parse(String(form.get("slides")))).toEqual([{
      title: slide.slideTitle,
      content: slide.body,
      speakerNotes: slide.speakerNotes,
    }]);
  });

  it("passes fit failures through for the teacher's fallback choice", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      code: "TEXT_OVERFLOW",
      error: "The lesson is too long for this design.",
      slide: 6,
    }, { status: 422 })));
    await expect(renderUploadedPpt({
      template: Buffer.from([80, 75, 3, 4]),
      slides: [slide],
      slideImageUrls: [null],
      serviceUrl: "https://ppt.example.com",
      serviceSecret: "secret",
    })).rejects.toMatchObject({
      code: "TEXT_OVERFLOW",
      status: 422,
      slide: 6,
    });
  });
});
