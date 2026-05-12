import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import mammoth from "mammoth";

export const runtime = "nodejs";
export const maxDuration = 60;

const requireFromHere = createRequire(import.meta.url);
type PdfParseResult = { text?: string };
type PdfParseFn = (data: Buffer) => Promise<PdfParseResult>;
const pdfParse: PdfParseFn = requireFromHere("pdf-parse") as PdfParseFn;

const MAX_BYTES = 12 * 1024 * 1024;

function sniff(buf: Buffer): "pdf" | "docx" | null {
  if (buf.includes(Buffer.from("%PDF"))) return "pdf";
  if (
    buf.length > 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
    (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
  ) {
    return "docx";
  }
  return null;
}

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 12 MB)." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a PDF (.pdf) or Word document (.docx)." },
      { status: 400 },
    );
  }

  try {
    let text = "";
    if (kind === "pdf") {
      const data = await pdfParse(buf);
      text = (data.text ?? "").trim();
    } else {
      const result = await mammoth.extractRawText({ buffer: buf });
      text = (result.value ?? "").trim();
      if (result.messages?.length) {
        console.warn("[differentiated-pack/extract] mammoth messages:", result.messages);
      }
    }

    if (!text) {
      return NextResponse.json(
        { error: "No text could be extracted. Try another file or export your lesson plan as PDF." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      extractedText: text.slice(0, 80_000),
      fileName: file.name,
      kind,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[differentiated-pack/extract]", msg);
    return NextResponse.json({ error: `Extraction failed: ${msg}` }, { status: 500 });
  }
}
