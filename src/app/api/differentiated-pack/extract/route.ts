import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import mammoth from "mammoth";
import JSZip from "jszip";
import { authenticateRequest } from "@/lib/user-usage-server";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";
import { inspectZipSafety, scanBufferForMalware } from "@/lib/upload-security";

export const runtime = "nodejs";
export const maxDuration = 60;

const requireFromHere = createRequire(import.meta.url);
type PdfParseResult = { text?: string };
type PdfParseFn = (data: Buffer) => Promise<PdfParseResult>;
const pdfParse: PdfParseFn = requireFromHere("pdf-parse") as PdfParseFn;

const MAX_BYTES = 12 * 1024 * 1024;

function decodeXml(t: string): string {
  return t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const SLIDE_PART_RE = /^ppt\/slides\/slide\d+\.xml$/;

/** Text of each <a:p> paragraph in a slide/notes XML part, one per line. */
function paragraphsFromXml(xml: string): string[] {
  const out: string[] = [];
  for (const p of xml.match(/<a:p[ >][\s\S]*?<\/a:p>/g) ?? []) {
    const line = [...p.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1])).join("");
    if (line.trim()) out.push(line.trim());
  }
  return out;
}

/** Slide text + speaker notes from an already-safety-checked .pptx zip. */
async function extractPptxText(zip: JSZip): Promise<string> {
  const num = (name: string) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const slideNames = Object.keys(zip.files).filter((n) => SLIDE_PART_RE.test(n)).sort((a, b) => num(a) - num(b));
  const parts: string[] = [];
  for (const name of slideNames) {
    const n = num(name);
    const slide = paragraphsFromXml(await zip.files[name].async("string"));
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${n}.xml`);
    // Notes parts also carry the slide-number field; drop bare-digit lines.
    const notes = notesFile
      ? paragraphsFromXml(await notesFile.async("string")).filter((l) => !/^\d+$/.test(l))
      : [];
    parts.push([`Slide ${n}:`, ...slide, ...(notes.length ? ["Notes:", ...notes] : [])].join("\n"));
  }
  return parts.join("\n\n");
}

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
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`differentiated-pack-extract:ip:${ip}`, 20, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

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
      { error: "Unsupported file type. Upload a PDF (.pdf), Word (.docx) or PowerPoint (.pptx) file." },
      { status: 400 },
    );
  }

  const scan = await scanBufferForMalware(buf, `differentiated-pack-extract:${auth.userId}:${file.name}`);
  if (scan.scanned && !scan.clean) {
    return NextResponse.json({ error: "This file failed a security scan and was rejected." }, { status: 422 });
  }

  let pptxZip: JSZip | null = null;
  if (kind === "docx") {
    // .docx and .pptx are zip containers — mammoth has no built-in decompression-bomb
    // guard, so open it with JSZip first (parses the central directory only,
    // no inflate) purely to check entry count / declared sizes before
    // mammoth ever unzips it for real.
    try {
      const zip = await JSZip.loadAsync(buf);
      const safety = inspectZipSafety(zip);
      if (!safety.ok) {
        return NextResponse.json(
          { error: `This file was rejected: ${safety.reason}` },
          { status: 400 },
        );
      }
      if (Object.keys(zip.files).some((n) => SLIDE_PART_RE.test(n))) pptxZip = zip;
    } catch {
      return NextResponse.json(
        { error: "This doesn't look like a valid .docx or .pptx file (could not read it as a ZIP)." },
        { status: 400 },
      );
    }
  }

  try {
    let text = "";
    if (pptxZip) {
      text = (await extractPptxText(pptxZip)).trim();
    } else if (kind === "pdf") {
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
