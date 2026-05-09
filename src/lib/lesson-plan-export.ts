import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import { TEACHER_PACKAGE_SECTIONS, type LessonPlanResult } from "@/lib/lesson-plan";

const PPT_COLORS = {
  blue: "1E40AF",
  lightBlue: "DBEAFE",
  white: "FFFFFF",
  dark: "0F172A",
  muted: "334155",
};

export function sanitizeExportFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Turn AI "PPT Slide Content" text into multiple slides.
 * Supports: Slide N: titles, ## headings, --- dividers, or length-based chunking.
 */
export function parsePptContentIntoSlides(raw: string): { title: string; body: string }[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [{ title: "Slide 1", body: "" }];

  const slideStarts = text.split(/\n(?=\s*Slide\s*\d+\s*[:\.\-–]?\s+)/i);
  if (slideStarts.length > 1 || /^\s*Slide\s*\d+/i.test(slideStarts[0])) {
    return slideStarts.map((segment, idx) => {
      const seg = segment.trim();
      const lines = seg.split("\n");
      const first = lines[0] ?? "";
      const titleFromFirst = first.replace(/^\s*Slide\s*\d+\s*[:\.\-–]?\s*/i, "").trim();
      const title =
        titleFromFirst.length > 0 && titleFromFirst.length < 120
          ? titleFromFirst
          : `Slide ${idx + 1}`;
      const bodyLines = titleFromFirst.length > 0 && titleFromFirst.length < 120 ? lines.slice(1) : lines;
      const body = bodyLines.join("\n").trim() || seg.replace(/^\s*Slide\s*\d+\s*[:\.\-–]?\s*/i, "").trim();
      return { title: title.slice(0, 120), body: body || "(Content on this slide.)" };
    });
  }

  const hashSplit = text.split(/\n(?=#{1,3}\s+)/);
  if (hashSplit.length > 1) {
    return hashSplit.map((block, idx) => {
      const m = block.match(/^#+\s*(.+)$/m);
      const title = (m?.[1]?.trim() || `Section ${idx + 1}`).slice(0, 120);
      const body = block.replace(/^#+\s*.+$/m, "").trim() || block.trim();
      return { title, body };
    });
  }

  const ruleSplit = text.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean);
  if (ruleSplit.length > 1) {
    return ruleSplit.map((block, idx) => {
      const lines = block.split("\n");
      const candidate = lines[0]?.trim() ?? `Section ${idx + 1}`;
      const useFirstAsTitle = candidate.length > 0 && candidate.length < 100;
      const title = useFirstAsTitle ? candidate.slice(0, 120) : `Section ${idx + 1}`;
      const body = useFirstAsTitle ? lines.slice(1).join("\n").trim() : block;
      return { title, body: body || block };
    });
  }

  const maxLen = 950;
  if (text.length <= maxLen) {
    return [{ title: "Presentation", body: text }];
  }

  const slides: { title: string; body: string }[] = [];
  let pos = 0;
  let n = 1;
  while (pos < text.length) {
    let end = Math.min(text.length, pos + maxLen);
    let chunk = text.slice(pos, end);
    if (end < text.length) {
      const br = chunk.lastIndexOf("\n\n");
      if (br > 280) {
        chunk = chunk.slice(0, br);
        end = pos + br;
      }
    }
    slides.push({ title: `Slide ${n}`, body: chunk.trim() });
    pos += chunk.length;
    n += 1;
  }
  return slides;
}

export async function buildDocxBuffer(params: {
  documentTitle: string;
  subject: string;
  grade: string;
  topic: string;
  content: string;
}): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: params.documentTitle,
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${params.subject} · ${params.grade} · ${params.topic}`,
          italics: true,
          size: 22,
        }),
      ],
      spacing: { after: 240 },
    }),
  ];

  const lines = params.content.length > 0 ? params.content.split("\n") : [" "];
  for (const line of lines) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: line.length ? line : " ", size: 24 })],
        spacing: { after: 80 },
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function buildPptxFromPptContent(params: {
  subject: string;
  grade: string;
  topic: string;
  pptContent: string;
}): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "EduPlan AI";
  pptx.company = "EduPlan AI";
  pptx.subject = `${params.subject} — ${params.topic}`;
  pptx.title = `Slides — ${params.topic}`;

  const slides = parsePptContentIntoSlides(params.pptContent);

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: PPT_COLORS.white };
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 2.1,
    fill: { color: PPT_COLORS.blue },
    line: { color: PPT_COLORS.blue },
  });
  titleSlide.addText("EduPlan AI", {
    x: 0.75,
    y: 0.55,
    w: 11.8,
    h: 0.45,
    fontSize: 14,
    color: PPT_COLORS.white,
    fontFace: "Calibri",
  });
  titleSlide.addText("PPT slide content", {
    x: 0.75,
    y: 1.05,
    w: 11.8,
    h: 0.85,
    fontSize: 30,
    bold: true,
    color: PPT_COLORS.white,
    fontFace: "Calibri",
  });
  titleSlide.addText(params.topic, {
    x: 0.75,
    y: 2.45,
    w: 11.8,
    h: 0.55,
    fontSize: 20,
    color: PPT_COLORS.dark,
    fontFace: "Calibri",
  });
  titleSlide.addText(`${params.subject}  ·  ${params.grade}`, {
    x: 0.75,
    y: 3.15,
    w: 11.8,
    h: 0.35,
    fontSize: 13,
    color: PPT_COLORS.muted,
    fontFace: "Calibri",
  });
  titleSlide.addText(`${slides.length} slide(s) in this deck`, {
    x: 0.75,
    y: 3.85,
    w: 11.5,
    h: 0.35,
    fontSize: 12,
    color: PPT_COLORS.dark,
    fontFace: "Calibri",
  });

  for (const { title, body } of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: PPT_COLORS.white };

    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.95,
      fill: { color: PPT_COLORS.blue },
      line: { color: PPT_COLORS.blue },
    });

    slide.addText(title, {
      x: 0.6,
      y: 0.28,
      w: 11.5,
      h: 0.5,
      fontSize: 22,
      bold: true,
      color: PPT_COLORS.white,
      fontFace: "Calibri",
    });

    slide.addText(`${params.subject} | ${params.grade} | ${params.topic}`, {
      x: 0.65,
      y: 1.08,
      w: 12,
      h: 0.28,
      fontSize: 11,
      color: PPT_COLORS.muted,
      fontFace: "Calibri",
    });

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.65,
      y: 1.55,
      w: 12.05,
      h: 5.45,
      rectRadius: 0.08,
      fill: { color: PPT_COLORS.lightBlue, transparency: 76 },
      line: { color: PPT_COLORS.lightBlue, pt: 1 },
    });

    slide.addText(body, {
      x: 0.9,
      y: 1.82,
      w: 11.5,
      h: 5,
      fontSize: 15,
      color: PPT_COLORS.dark,
      valign: "top",
      fit: "shrink",
      breakLine: true,
      fontFace: "Calibri",
    });

    slide.addText("EduPlan AI", {
      x: 0.65,
      y: 7.18,
      w: 12,
      h: 0.2,
      fontSize: 9,
      color: PPT_COLORS.muted,
      align: "right",
      fontFace: "Calibri",
    });
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

export async function buildTeacherPackageZipBuffer(params: {
  subject: string;
  grade: string;
  topic: string;
  lessonPlan: LessonPlanResult;
}): Promise<Buffer> {
  const base = sanitizeExportFileName(`${params.grade}-${params.subject}-${params.topic}`) || "teacher-package";
  const meta = {
    subject: params.subject,
    grade: params.grade,
    topic: params.topic,
  };

  const zip = new JSZip();

  zip.file(
    `${base}-ppt-content.pptx`,
    await buildPptxFromPptContent({
      ...meta,
      pptContent: params.lessonPlan["PPT Slide Content"] ?? "",
    }),
  );

  const docxParts: { file: string; title: string; key: (typeof TEACHER_PACKAGE_SECTIONS)[number] }[] = [
    { file: `${base}-lesson-plan.docx`, title: "Lesson Plan", key: "Full Lesson Plan" },
    { file: `${base}-worksheet.docx`, title: "Worksheet", key: "Worksheet" },
    { file: `${base}-assessment.docx`, title: "Assessment Questions", key: "Assessment Questions" },
    { file: `${base}-homework.docx`, title: "Homework", key: "Homework Task" },
    { file: `${base}-teacher-notes.docx`, title: "Teacher Notes", key: "Teacher Notes" },
  ];

  for (const part of docxParts) {
    zip.file(
      part.file,
      await buildDocxBuffer({
        documentTitle: part.title,
        ...meta,
        content: params.lessonPlan[part.key] ?? "",
      }),
    );
  }

  return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
