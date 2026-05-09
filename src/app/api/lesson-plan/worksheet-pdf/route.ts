import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type WorksheetPdfBody = {
  subject?: string;
  grade?: string;
  topic?: string;
  worksheet?: string;
};

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function buildPdfBuffer(
  subject: string,
  grade: string,
  topic: string,
  worksheet: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 54,
      size: "A4",
      info: { Title: `Worksheet — ${topic}`, Author: "EduPlan AI" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const margin = 54;
    const textWidth = doc.page.width - margin * 2;

    doc.fillColor("#1e40af").fontSize(20).text("Worksheet", { underline: false });
    doc.moveDown(0.4);
    doc.fillColor("#475569").fontSize(11).text(`${subject}  ·  ${grade}  ·  ${topic}`, {
      width: textWidth,
    });
    doc.moveDown(1);
    doc.fillColor("#0f172a").fontSize(10).text(worksheet, {
      width: textWidth,
      align: "left",
      lineGap: 4,
    });
    doc.end();
  });
}

export async function POST(req: Request) {
  let body: WorksheetPdfBody;
  try {
    body = (await req.json()) as WorksheetPdfBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const worksheet = body.worksheet?.trim();
  if (!worksheet) {
    return NextResponse.json(
      { error: "Worksheet content is required to generate a PDF." },
      { status: 400 },
    );
  }

  const subject = body.subject?.trim() || "Subject";
  const grade = body.grade?.trim() || "Grade";
  const topic = body.topic?.trim() || "Topic";

  try {
    const buffer = await buildPdfBuffer(subject, grade, topic, worksheet);
    const fileName = sanitizeFileName(`${grade}-${subject}-${topic}-worksheet`);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName || "worksheet"}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate PDF." }, { status: 500 });
  }
}
