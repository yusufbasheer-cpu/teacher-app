import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import { TEACHER_PACKAGE_SECTIONS, type LessonPlanResult } from "@/lib/lesson-plan";

const PPT_COLORS = {
  blue: "1B3A6B",
  lightBlue: "EAF1FB",
  accent: "F5A623",
  white: "FFFFFF",
  dark: "333333",
  muted: "5B6472",
  blueMid: "234A82",
  blueDeep: "102746",
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

async function fetchImageUrlAsDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching image`);
  }
  const mimeRaw = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const mime = mimeRaw.startsWith("image/") ? mimeRaw : "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function stripMarkdownText(input: string): string {
  const cleaned = input
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "• ")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Extra hard strip for symbols user explicitly flagged.
  return cleaned.replace(/[*#_]/g, "").trim();
}

function cleanSlideTitle(title: string): string {
  return stripMarkdownText(title).slice(0, 120) || "Slide";
}

function toBulletLines(body: string): string[] {
  const plain = stripMarkdownText(body);
  if (!plain) return ["(No content provided)"];
  const rawLines = plain
    .split(/\n|(?<=\.)\s+(?=[A-Z0-9])/)
    .map((l) => l.trim())
    .filter(Boolean);
  const lines = rawLines.length > 0 ? rawLines : [plain];
  return lines.slice(0, 8);
}

function toAccentRuns(line: string): Array<{ text: string; options: Record<string, unknown> }> {
  const normalized = line.replace(/^•\s*/, "").trim();
  if (!normalized) {
    return [{ text: "• ", options: { color: PPT_COLORS.dark, fontFace: "Calibri", fontSize: 22 } }];
  }

  const colon = normalized.indexOf(":");
  if (colon > 1 && colon < 42) {
    return [
      {
        text: "• ",
        options: { color: PPT_COLORS.dark, fontFace: "Calibri", fontSize: 22 },
      },
      {
        text: `${normalized.slice(0, colon)}: `,
        options: { color: PPT_COLORS.accent, bold: true, fontFace: "Calibri", fontSize: 22 },
      },
      {
        text: normalized.slice(colon + 1).trim(),
        options: { color: PPT_COLORS.dark, fontFace: "Calibri", fontSize: 22 },
      },
    ];
  }

  return [
    {
      text: `• ${normalized}`,
      options: { color: PPT_COLORS.dark, fontFace: "Calibri", fontSize: 22 },
    },
  ];
}

function addSlideFooter(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  subject: string,
  grade: string,
  slideNumberText: string,
) {
  slide.addShape(pptx.ShapeType.line, {
    x: 0.6,
    y: 7.0,
    w: 12.1,
    h: 0,
    line: { color: "DDE6F5", pt: 1 },
  });
  slide.addText(`${subject} · ${grade}`, {
    x: 0.7,
    y: 7.08,
    w: 7,
    h: 0.24,
    fontSize: 16,
    color: PPT_COLORS.muted,
    fontFace: "Calibri",
  });
  slide.addText(slideNumberText, {
    x: 10.9,
    y: 7.08,
    w: 1.8,
    h: 0.24,
    fontSize: 16,
    color: PPT_COLORS.muted,
    fontFace: "Calibri",
    align: "right",
  });
}

function addImagePlaceholder(pptx: PptxGenJS, slide: PptxGenJS.Slide) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 7.72,
    y: 1.78,
    w: 4.95,
    h: 4.9,
    rectRadius: 0.06,
    fill: { color: "F6F8FC" },
    line: { color: "D0DEFA", pt: 1 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 9.2,
    y: 3.0,
    w: 1.9,
    h: 1.35,
    fill: { color: "E3EAF8" },
    line: { color: "B8CAE9", pt: 1 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 9.45,
    y: 3.85,
    w: 1.35,
    h: 0.4,
    fill: { color: "C8D8F2" },
    line: { color: "C8D8F2", pt: 0.5 },
  });
  slide.addText("Image unavailable", {
    x: 8.0,
    y: 5.05,
    w: 4.4,
    h: 0.28,
    fontSize: 14,
    color: PPT_COLORS.muted,
    fontFace: "Calibri",
    align: "center",
  });
}

export async function buildPptxFromPptContent(params: {
  subject: string;
  grade: string;
  topic: string;
  pptContent: string;
  /** One fal image URL per parsed content slide (same order as `parsePptContentIntoSlides`). */
  slideImageUrls?: (string | null)[] | null;
}): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "EduPlan AI";
  pptx.company = "EduPlan AI";
  pptx.subject = `${params.subject} — ${params.topic}`;
  pptx.title = `Slides — ${params.topic}`;

  const slides = parsePptContentIntoSlides(params.pptContent);
  const slideImageUrls = params.slideImageUrls ?? null;

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: PPT_COLORS.blueDeep };
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: PPT_COLORS.blueMid, transparency: 12 },
    line: { color: PPT_COLORS.blueMid, transparency: 100 },
  });
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 3.1,
    fill: { color: PPT_COLORS.blue, transparency: 15 },
    line: { color: PPT_COLORS.blue, transparency: 100 },
  });
  titleSlide.addShape(pptx.ShapeType.line, {
    x: 2.05,
    y: 4.72,
    w: 9.2,
    h: 0,
    line: { color: PPT_COLORS.accent, pt: 2.5 },
  });
  titleSlide.addText(cleanSlideTitle(params.topic), {
    x: 1.15,
    y: 2.2,
    w: 11.05,
    h: 1.1,
    fontSize: 40,
    bold: true,
    color: PPT_COLORS.white,
    fontFace: "Calibri",
    align: "center",
    fit: "shrink",
  });
  titleSlide.addText("Classroom Presentation", {
    x: 1.15,
    y: 3.5,
    w: 11.05,
    h: 0.55,
    fontSize: 18,
    color: "E2ECFF",
    fontFace: "Calibri",
    align: "center",
  });
  titleSlide.addText(`${params.subject} · ${params.grade}`, {
    x: 1.15,
    y: 6.68,
    w: 11.05,
    h: 0.35,
    fontSize: 17,
    color: PPT_COLORS.white,
    fontFace: "Calibri",
    align: "center",
  });
  titleSlide.addText(`Slide 1`, {
    x: 10.95,
    y: 7.08,
    w: 1.7,
    h: 0.24,
    fontSize: 16,
    color: "D7E7FF",
    fontFace: "Calibri",
    align: "right",
  });

  for (let slideIdx = 0; slideIdx < slides.length; slideIdx++) {
    const { title, body } = slides[slideIdx]!;
    const slide = pptx.addSlide();
    slide.background = { color: PPT_COLORS.white };

    const remoteUrl = slideImageUrls?.[slideIdx] ?? null;
    let imageDataUri: string | null = null;
    if (remoteUrl) {
      try {
        imageDataUri = await fetchImageUrlAsDataUri(remoteUrl);
      } catch (e) {
        console.warn("[pptx] could not embed slide image", slideIdx + 1, e);
      }
    }

    const hasImage = Boolean(imageDataUri);
    const titleText = cleanSlideTitle(title);
    const bulletLines = toBulletLines(body);
    const textStartX = 0.95;
    const textWidth = hasImage ? 6.35 : 11.5;

    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.38,
      fill: { color: PPT_COLORS.blue },
      line: { color: PPT_COLORS.blue },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.02,
      y: 0.55,
      w: 0.18,
      h: 5.95,
      fill: { color: PPT_COLORS.accent, transparency: 8 },
      line: { color: PPT_COLORS.accent, transparency: 100 },
    });

    slide.addText(titleText, {
      x: textStartX,
      y: 0.66,
      w: hasImage ? 7.0 : 11.2,
      h: 0.82,
      fontSize: 38,
      bold: true,
      color: PPT_COLORS.blue,
      fontFace: "Calibri",
      fit: "shrink",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: textStartX,
      y: 1.58,
      w: hasImage ? 6.95 : 10.7,
      h: 0,
      line: { color: PPT_COLORS.accent, pt: 2.25 },
    });

    slide.addText(`${params.subject} · ${params.grade}`, {
      x: textStartX,
      y: 1.72,
      w: textWidth,
      h: 0.3,
      fontSize: 17,
      color: PPT_COLORS.muted,
      fontFace: "Calibri",
    });

    let lineY = 2.18;
    for (const line of bulletLines) {
      const runs = toAccentRuns(line);
      slide.addText(runs, {
        x: textStartX,
        y: lineY,
        w: textWidth,
        h: 0.58,
        valign: "top",
        fit: "shrink",
        breakLine: true,
      });
      lineY += 0.64;
      if (lineY > 6.45) break;
    }

    if (imageDataUri) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 7.72,
        y: 1.78,
        w: 4.95,
        h: 4.9,
        rectRadius: 0.06,
        fill: { color: PPT_COLORS.lightBlue, transparency: 20 },
        line: { color: "D0DEFA", pt: 1 },
      });
      slide.addImage({
        data: imageDataUri,
        x: 7.88,
        y: 1.92,
        w: 4.72,
        h: 4.62,
        rounding: true,
        altText: "AI-generated illustration for this slide",
      });
    } else if (slideImageUrls && slideImageUrls.length > 0) {
      // fal may fail for one slide; keep PPT generation stable with a visible placeholder.
      addImagePlaceholder(pptx, slide);
    }

    addSlideFooter(pptx, slide, params.subject, params.grade, `Slide ${slideIdx + 2}`);
  }

  const closing = pptx.addSlide();
  closing.background = { color: PPT_COLORS.blueDeep };
  closing.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: PPT_COLORS.blue, transparency: 24 },
    line: { color: PPT_COLORS.blue, transparency: 100 },
  });
  closing.addShape(pptx.ShapeType.line, {
    x: 3.2,
    y: 4.08,
    w: 6.9,
    h: 0,
    line: { color: PPT_COLORS.accent, pt: 2.5 },
  });
  closing.addText("Thank You", {
    x: 1.8,
    y: 2.35,
    w: 9.8,
    h: 0.95,
    fontSize: 40,
    bold: true,
    color: PPT_COLORS.white,
    fontFace: "Calibri",
    align: "center",
  });
  closing.addText("Questions and recap discussion", {
    x: 2.0,
    y: 3.25,
    w: 9.4,
    h: 0.45,
    fontSize: 18,
    color: "E2ECFF",
    fontFace: "Calibri",
    align: "center",
  });
  addSlideFooter(pptx, closing, params.subject, params.grade, `Slide ${slides.length + 2}`);

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

  const pptRaw = params.lessonPlan["PPT Slide Content"];
  if (typeof pptRaw === "string" && pptRaw.trim().length > 0) {
    zip.file(
      `${base}-ppt-content.pptx`,
      await buildPptxFromPptContent({
        ...meta,
        pptContent: pptRaw,
      }),
    );
  }

  const docxParts: { file: string; title: string; key: (typeof TEACHER_PACKAGE_SECTIONS)[number] }[] = [
    { file: `${base}-lesson-plan.docx`, title: "Lesson Plan", key: "Full Lesson Plan" },
    { file: `${base}-worksheet.docx`, title: "Worksheet", key: "Worksheet" },
    { file: `${base}-assessment.docx`, title: "Assessment Questions", key: "Assessment Questions" },
    { file: `${base}-homework.docx`, title: "Homework", key: "Homework Task" },
    { file: `${base}-teacher-notes.docx`, title: "Teacher Notes", key: "Teacher Notes" },
  ];

  for (const part of docxParts) {
    const raw = params.lessonPlan[part.key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      zip.file(
        part.file,
        await buildDocxBuffer({
          documentTitle: part.title,
          ...meta,
          content: raw,
        }),
      );
    }
  }

  if (Object.keys(zip.files).length === 0) {
    throw new Error("No exportable teacher-package sections in lesson plan.");
  }

  return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
