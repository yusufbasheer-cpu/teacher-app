import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import { createWorker, PSM, type Worker } from "tesseract.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = (step: string, detail?: Record<string, unknown>) => {
  console.log("[extract-upload]", step, detail ?? "");
};

/** Load pdf-parse via require() so `module.parent` is set and the package test harness does not run (see pdf-parse index.js `!module.parent`). */
const requireFromHere = createRequire(import.meta.url);
type PdfParseResult = { text?: string };
type PdfParseFn = (data: Buffer) => Promise<PdfParseResult>;
const pdfParse: PdfParseFn = requireFromHere("pdf-parse") as PdfParseFn;

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
  const scanLen = Math.min(buf.length, 4096);
  const head = buf.subarray(0, scanLen);
  if (head.includes(Buffer.from("%PDF"))) {
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

async function extractTextFromPdf(buffer: Buffer, label: string): Promise<string> {
  log("pdf-parse: start", { label, bufferBytes: buffer.byteLength });
  try {
    const data = await pdfParse(buffer);
    const text = (data.text ?? "").trim();
    log("pdf-parse: done", { label, textLength: text.length });
    return text;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("pdf-parse: error", { label, message: msg });
    throw new Error(`PDF text extraction failed: ${msg}`);
  }
}

async function createOcrWorker(): Promise<Worker> {
  log("tesseract: creating worker", { lang: "eng" });
  const worker = await createWorker("eng", undefined, {
    logger: (m) =>
      log("tesseract: progress", {
        status: m.status,
        progress: m.progress,
        jobId: m.userJobId,
      }),
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
  });
  log("tesseract: worker ready");
  return worker;
}

async function extractTextFromImageWithTesseract(
  buffer: Buffer,
  label: string,
  worker: Worker,
): Promise<string> {
  log("tesseract: recognize start", { label, bufferBytes: buffer.byteLength });
  try {
    const result = await worker.recognize(buffer);
    const text = (result.data.text ?? "").trim();
    log("tesseract: recognize done", {
      label,
      textLength: text.length,
      confidence: result.data.confidence,
    });
    return text;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("tesseract: recognize error", { label, message: msg });
    throw new Error(`Image OCR failed (Tesseract.js): ${msg}`);
  }
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
  log("POST: start", {
    contentType: req.headers.get("content-type")?.slice(0, 80) ?? null,
  });

  let ocrWorker: Worker | undefined;

  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("POST: formData parse failed", { message: msg });
      return NextResponse.json(
        { error: `Could not read multipart upload: ${msg}` },
        { status: 400 },
      );
    }

    const files = collectFiles(formData);
    log("POST: files collected", { count: files.length, names: files.map((f) => f.name) });

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Missing file upload(s). Use field name "files" or "file".' },
        { status: 400 },
      );
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

    const workItems: { label: string; buffer: Buffer; sniffed: Sniffed }[] = [];

    for (const file of files) {
      const label = file.name?.trim() || "upload";
      log("file: reading arrayBuffer", { label, reportedSize: file.size, type: file.type });
      let buffer: Buffer;
      try {
        const ab = await file.arrayBuffer();
        buffer = Buffer.from(ab);
        log("file: buffer ready", { label, bufferBytes: buffer.byteLength });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log("file: arrayBuffer failed", { label, message: msg });
        partialErrors.push({ sourceLabel: label, message: `Could not read file data: ${msg}` });
        continue;
      }

      const sniffed = sniffFileType(buffer);
      log("file: sniff", { label, sniffed });
      if (!sniffed) {
        partialErrors.push({
          sourceLabel: label,
          message: "Unsupported type. Use PDF, JPG, or PNG.",
        });
        continue;
      }
      workItems.push({ label, buffer, sniffed });
    }

    const needsOcr = workItems.some((w) => w.sniffed === "jpeg" || w.sniffed === "png");
    if (needsOcr) {
      ocrWorker = await createOcrWorker();
    }

    for (const item of workItems) {
      const { label, buffer, sniffed } = item;
      try {
        if (sniffed === "pdf") {
          const text = await extractTextFromPdf(buffer, label);
          if (!text) {
            partialErrors.push({
              sourceLabel: label,
              message:
                "No extractable text in this PDF (it may be scanned pages only). Try JPG/PNG photos of pages, or a text-based PDF.",
            });
            continue;
          }
          parts.push({ sourceLabel: label, kind: "pdf", text });
          continue;
        }

        if (!ocrWorker) {
          throw new Error("OCR worker was not initialized for image processing.");
        }
        const text = await extractTextFromImageWithTesseract(buffer, label, ocrWorker);
        if (!text) {
          partialErrors.push({
            sourceLabel: label,
            message:
              "No text was detected in this image (try a higher-resolution photo, better lighting, or clearer print).",
          });
          continue;
        }
        parts.push({ sourceLabel: label, kind: "image", text });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Extraction failed.";
        log("file: extraction threw", { label, message });
        partialErrors.push({ sourceLabel: label, message });
      }
    }

    if (parts.length === 0) {
      log("POST: no parts extracted", { partialErrorCount: partialErrors.length });
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

    log("POST: success", {
      partCount: parts.length,
      extractedChars: extractedText.length,
      partialErrorCount: partialErrors.length,
    });

    return NextResponse.json({
      extractedText,
      parts,
      ...(partialErrors.length > 0 ? { partialErrors } : {}),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    log("POST: unhandled error", { message, stack: stack?.slice(0, 500) });
    return NextResponse.json(
      { error: `Extract upload failed (server): ${message}` },
      { status: 500 },
    );
  } finally {
    if (ocrWorker) {
      try {
        log("tesseract: terminating worker");
        await ocrWorker.terminate();
      } catch (termErr) {
        log("tesseract: terminate warning", {
          message: termErr instanceof Error ? termErr.message : String(termErr),
        });
      }
    }
  }
}
