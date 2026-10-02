import { afterEach, describe, expect, it, vi } from "vitest";
import { renderUploadedPpt } from "./uploaded-ppt-export";
import { fetchExternalImageSafely } from "./upload-security";

vi.mock("./upload-security", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./upload-security")>()),
  fetchExternalImageSafely: vi.fn(),
}));

const slide = {
  slideTitle: "Learning Objectives",
  body: "Explain the water cycle.",
  speakerNotes: "Ask for examples.",
  includeImageSlot: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(fetchExternalImageSafely).mockReset();
});

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

  it("uploads Pexels and Fal images for their matching slides", async () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const jpeg = Buffer.from([255, 216, 255, 224, 0]);
    vi.mocked(fetchExternalImageSafely)
      .mockResolvedValueOnce(jpeg)
      .mockResolvedValueOnce(png);
    const mock = vi.fn().mockResolvedValue(new Response(new Uint8Array([80, 75, 3, 4]), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    await renderUploadedPpt({
      template: Buffer.from([80, 75, 3, 4]),
      slides: [slide, slide],
      slideImageUrls: ["https://images.pexels.com/photo.jpg", "https://v3.fal.media/image.png"],
      serviceUrl: "https://ppt.example.com",
      serviceSecret: "secret",
    });
    expect(fetchExternalImageSafely).toHaveBeenCalledWith(expect.any(String), { maxBytes: 20 * 1024 * 1024 });
    const form = (mock.mock.calls[0] as [string, RequestInit])[1].body as FormData;
    expect(Buffer.from(await (form.get("image_0") as Blob).arrayBuffer())).toEqual(jpeg);
    expect(Buffer.from(await (form.get("image_1") as Blob).arrayBuffer())).toEqual(png);
  });

  it("reports a failed image download instead of exporting a deck with a missing image", async () => {
    vi.mocked(fetchExternalImageSafely).mockRejectedValue(new Error("Image exceeds limit"));
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    await expect(renderUploadedPpt({
      template: Buffer.from([80, 75, 3, 4]),
      slides: [slide],
      slideImageUrls: ["https://v3.fal.media/image.png"],
      serviceUrl: "https://ppt.example.com",
      serviceSecret: "secret",
    })).rejects.toMatchObject({ code: "IMAGE_UNAVAILABLE", slide: 1 });
    expect(mock).not.toHaveBeenCalled();
  });
});
