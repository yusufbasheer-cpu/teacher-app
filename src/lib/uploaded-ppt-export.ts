import { fetchExternalImageSafely, sniffFileSignature } from "@/lib/upload-security";
import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";

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
  const form = new FormData();
  form.append("template", new Blob([new Uint8Array(params.template)], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  }), "template.pptx");
  form.append("slides", JSON.stringify(params.slides.map((slide) => ({
    title: slide.slideTitle,
    content: slide.body,
    speakerNotes: slide.speakerNotes,
  }))));

  await Promise.all(params.slideImageUrls.map(async (url, index) => {
    if (!url) return;
    try {
      const bytes = await fetchExternalImageSafely(url, { timeoutMs: 8000, maxBytes: 3 * 1024 * 1024 });
      const signature = sniffFileSignature(bytes);
      if (signature === "png" || signature === "jpeg") {
        form.append(`image_${index}`, new Blob([new Uint8Array(bytes)], {
          type: `image/${signature}`,
        }), `slide-${index}.${signature === "jpeg" ? "jpg" : "png"}`);
      }
    } catch (error) {
      console.warn("[uploaded ppt] image unavailable", index, error);
    }
  }));

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
