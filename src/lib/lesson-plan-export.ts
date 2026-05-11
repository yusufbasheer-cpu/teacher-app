import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import { TEACHER_PACKAGE_SECTIONS, type LessonPlanResult } from "@/lib/lesson-plan";
import { parsePptContentIntoSlides } from "@/lib/ppt-slide-parse";

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

/** Re-export for callers that already imported from lesson-plan-export. */
export { parsePptContentIntoSlides } from "@/lib/ppt-slide-parse";

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
    const textPanelW = hasImage ? 6.95 : 12.05;
    const textInnerW = hasImage ? 6.55 : 11.5;

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
      w: 12.2,
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
      w: textPanelW,
      h: 5.45,
      rectRadius: 0.08,
      fill: { color: PPT_COLORS.lightBlue, transparency: 76 },
      line: { color: PPT_COLORS.lightBlue, pt: 1 },
    });

    slide.addText(body, {
      x: 0.9,
      y: 1.82,
      w: textInnerW,
      h: 5,
      fontSize: 15,
      color: PPT_COLORS.dark,
      valign: "top",
      fit: "shrink",
      breakLine: true,
      fontFace: "Calibri",
    });

    if (imageDataUri) {
      slide.addImage({
        data: imageDataUri,
        x: 7.78,
        y: 1.55,
        w: 4.88,
        h: 5.35,
        rounding: true,
        altText: "AI-generated illustration for this slide",
      });
    }

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
