import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;
const MAX_FILES = 24;

type Sniffed = "pdf" | "jpeg" | "png";

type ExtractedPart = {
  sourceLabel: string;
  kind: "pdf" | "image";
  text: string;
};

type ExtractPartialError = {
  sourceLabel: string;
  message: string;
};

function sniffFileType(buf: Buffer): Sniffed | null {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "pdf";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "png";
  }
  return null;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text ?? "").trim();
  } finally {
    await parser.destroy();
  }
}

type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function extractTextFromImageWithDeepSeek(
  apiKey: string,
  mime: "image/jpeg" | "image/png",
  buffer: Buffer,
): Promise<string> {
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  const visionModels = [
    process.env.DEEPSEEK_VISION_MODEL?.trim(),
    "deepseek-chat",
  ].filter((m): m is string => Boolean(m && m.length > 0));

  const seen = new Set<string>();
  const models = visionModels.filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });

  const userContent: VisionContentPart[] = [
    {
      type: "text",
      text: `You are an OCR and document-reading assistant for teachers. Transcribe every readable educational text from this image in natural reading order. Include titles, body paragraphs, labels on diagrams, captions, and bullet or numbered lists. If there is almost no text, briefly describe what is shown and how it could support a lesson. Output plain text only — no markdown code fences.`,
    },
    { type: "image_url", image_url: { url: dataUrl } },
  ];

  let lastError = "Vision request failed.";
  for (const model of models) {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 8192,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      lastError = raw.slice(0, 500) || res.statusText;
      continue;
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    } catch {
      lastError = "Invalid JSON from DeepSeek.";
      continue;
    }

    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (text.length > 0) {
      return text;
    }
    lastError = "DeepSeek returned empty text for this image.";
  }

  throw new Error(lastError);
}

function collectFiles(formData: FormData): File[] {
  const multi = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (multi.length > 0) {
    return multi;
  }
  const single = formData.get("file");
  if (single instanceof File) {
    return [single];
  }
  return [];
}

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing DEEPSEEK_API_KEY in environment variables." },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const files = collectFiles(formData);
  if (files.length === 0) {
    return NextResponse.json({ error: "Missing file upload(s). Use field name \"files\" or \"file\"." }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too many files at once. Maximum is ${MAX_FILES}.` },
      { status: 400 },
    );
  }

  let totalBytes = 0;
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `"${f.name}" is too large. Each file may be at most ${MAX_FILE_BYTES / (1024 * 1024)} MB.`,
        },
        { status: 400 },
      );
    }
    totalBytes += f.size;
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        error: `Total upload size is too large (max ${MAX_TOTAL_BYTES / (1024 * 1024)} MB across all files).`,
      },
      { status: 400 },
    );
  }

  const parts: ExtractedPart[] = [];
  const partialErrors: ExtractPartialError[] = [];

  for (const file of files) {
    const label = file.name?.trim() || "upload";
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch {
      partialErrors.push({ sourceLabel: label, message: "Could not read file data." });
      continue;
    }

    const sniffed = sniffFileType(buffer);
    if (!sniffed) {
      partialErrors.push({
        sourceLabel: label,
        message: "Unsupported type. Use PDF, JPG, or PNG.",
      });
      continue;
    }

    try {
      if (sniffed === "pdf") {
        const text = await extractTextFromPdf(buffer);
        if (!text) {
          partialErrors.push({
            sourceLabel: label,
            message:
              "No extractable text in this PDF (it may be image-only). Try images of the pages or a text-based PDF.",
          });
          continue;
        }
        parts.push({ sourceLabel: label, kind: "pdf", text });
        continue;
      }

      const mime: "image/jpeg" | "image/png" = sniffed === "jpeg" ? "image/jpeg" : "image/png";
      const text = await extractTextFromImageWithDeepSeek(apiKey, mime, buffer);
      parts.push({ sourceLabel: label, kind: "image", text });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Extraction failed.";
      partialErrors.push({ sourceLabel: label, message });
    }
  }

  if (parts.length === 0) {
    return NextResponse.json(
      {
        error: "No text could be extracted from any uploaded file.",
        partialErrors,
      },
      { status: 422 },
    );
  }

  const extractedText = parts
    .map((p) => `===== ${p.sourceLabel} (${p.kind}) =====\n${p.text}`)
    .join("\n\n");

  return NextResponse.json({
    extractedText,
    parts,
    ...(partialErrors.length > 0 ? { partialErrors } : {}),
  });
}
