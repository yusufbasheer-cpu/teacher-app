import { fetchExternalImageSafely, sniffFileSignature } from "@/lib/upload-security";
import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import sharp from "sharp";

// Leave room for multipart boundaries below Vercel's 4.5 MB function-body limit.
const MAX_TEMPLATE_REQUEST_BYTES = 4 * 1024 * 1024;
const IMAGE_PRESETS = [
  { width: 1280, height: 720, quality: 72 },
  { width: 960, height: 540, quality: 60 },
  { width: 720, height: 405, quality: 50 },
] as const;

async function compressSlideImage(bytes: Buffer, preset: (typeof IMAGE_PRESETS)[number]): Promise<Buffer> {
  return sharp(bytes, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: preset.width, height: preset.height, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: preset.quality, mozjpeg: true })
    .toBuffer();
}

export class UploadedTemplateError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly slide: number | null = null,
  ) {
    super(message);
  }
}

export async function renderUploadedPpt(params: {
  template: Buffer;
  slides: StructuredLessonSlideModel[];
  slideImageUrls: (string | null)[];
  serviceUrl: string;
  serviceSecret: string;
}): Promise<Buffer> {
  const slidesJson = JSON.stringify(params.slides.map((slide) => ({
    title: slide.slideTitle,
    content: slide.body,
    speakerNotes: slide.speakerNotes,
  })));
  const estimateBytes = (images: readonly { output: Buffer }[]) =>
    params.template.length + Buffer.byteLength(slidesJson) +
    images.reduce((total, image) => total + image.output.length, 0) +
    2048 * (images.length + 2);
  if (estimateBytes([]) > MAX_TEMPLATE_REQUEST_BYTES) {
    throw new UploadedTemplateError(422, "TEMPLATE_TOO_LARGE_FOR_EXPORT", "This PowerPoint is too large to fill with lesson images. Please upload a smaller PPTX or use a Layah design.");
  }

  const form = new FormData();
  form.append("template", new Blob([new Uint8Array(params.template)], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  }), "template.pptx");
  form.append("slides", slidesJson);

  const images = (await Promise.all(params.slideImageUrls.map(async (url, index) => {
    if (!url) return null;
    try {
      // Match the built-in PPT renderer's image limit. Fal PNGs can exceed 3 MB.
      const bytes = await fetchExternalImageSafely(url, { maxBytes: 20 * 1024 * 1024 });
      const signature = sniffFileSignature(bytes);
      if (signature !== "png" && signature !== "jpeg" && signature !== "webp") {
        throw new Error(`Unsupported image format: ${signature ?? "unknown"}`);
      }
      return { index, source: bytes, output: await compressSlideImage(bytes, IMAGE_PRESETS[0]) };
    } catch (error) {
      console.warn("[uploaded ppt] image unavailable", index, error);
      throw new UploadedTemplateError(503, "IMAGE_UNAVAILABLE", `The image for slide ${index + 1} could not be added. Please retry the download.`, index + 1);
    }
  }))).filter((image): image is { index: number; source: Buffer; output: Buffer } => image !== null);

  for (const preset of IMAGE_PRESETS.slice(1)) {
    if (estimateBytes(images) <= MAX_TEMPLATE_REQUEST_BYTES) break;
    await Promise.all(images.map(async (image) => {
      image.output = await compressSlideImage(image.source, preset);
    }));
  }
  if (estimateBytes(images) > MAX_TEMPLATE_REQUEST_BYTES) {
    throw new UploadedTemplateError(422, "TEMPLATE_TOO_LARGE_FOR_EXPORT", "This PowerPoint and its lesson images are too large to export. Please upload a smaller PPTX or use a Layah design.");
  }
  for (const image of images) {
    form.append(`image_${image.index}`, new Blob([new Uint8Array(image.output)], { type: "image/jpeg" }), `slide-${image.index}.jpg`);
  }

  let response: Response;
  try {
    response = await fetch(`${params.serviceUrl}/render-uploaded-template`, {
      method: "POST",
      headers: { "X-Template-Service-Secret": params.serviceSecret },
      body: form,
      signal: AbortSignal.timeout(100_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[uploaded ppt] template service unavailable", error);
    throw new UploadedTemplateError(503, "TEMPLATE_SERVICE_UNAVAILABLE", "We couldn't finish checking your PowerPoint. Please retry or use a Layah template.");
  }
  if (!response.ok) {
    const issue = await response.json().catch(() => ({})) as { code?: string; error?: string; slide?: number };
    if (response.status === 422) {
      throw new UploadedTemplateError(422, issue.code ?? "TEMPLATE_INCOMPATIBLE", issue.error ?? "This PowerPoint cannot fit the lesson.", issue.slide ?? null);
    }
    console.error("[uploaded ppt] template service error", response.status, issue.error);
    throw new UploadedTemplateError(503, "TEMPLATE_SERVICE_UNAVAILABLE", "We couldn't finish checking your PowerPoint. Please retry or use a Layah template.");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.subarray(0, 2).toString() !== "PK") {
    throw new UploadedTemplateError(503, "VALIDATION_FAILED", "The PowerPoint output could not be validated. Please retry or use a Layah template.");
  }
  return buffer;
}
