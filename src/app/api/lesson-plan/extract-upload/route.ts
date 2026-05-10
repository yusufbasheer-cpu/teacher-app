import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MAX_FILE_BYTES = 12 * 1024 * 1024;

type Sniffed = "pdf" | "jpeg" | "png";

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

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_BYTES / (1024 * 1024)} MB.` },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sniffed = sniffFileType(buffer);
  if (!sniffed) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a PDF, JPG, or PNG." },
      { status: 400 },
    );
  }

  try {
    if (sniffed === "pdf") {
      const text = await extractTextFromPdf(buffer);
      if (!text) {
        return NextResponse.json(
          {
            error:
              "No extractable text was found in this PDF. It may be scanned pages only — try a text-based PDF or upload page images (JPG/PNG) instead.",
          },
          { status: 422 },
        );
      }
      return NextResponse.json({
        extractedText: text,
        sourceLabel: file.name || "upload.pdf",
        kind: "pdf",
      });
    }

    const mime: "image/jpeg" | "image/png" = sniffed === "jpeg" ? "image/jpeg" : "image/png";
    const text = await extractTextFromImageWithDeepSeek(apiKey, mime, buffer);
    return NextResponse.json({
      extractedText: text,
      sourceLabel: file.name || (sniffed === "jpeg" ? "upload.jpg" : "upload.png"),
      kind: "image",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
