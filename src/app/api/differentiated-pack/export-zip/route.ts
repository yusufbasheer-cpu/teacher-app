import { NextResponse } from "next/server";
import JSZip from "jszip";
import { buildDocxBuffer, sanitizeExportFileName } from "@/lib/lesson-plan-export";
import type { DifferentiatedPackContent } from "@/lib/differentiated-pack-markers";
import { authenticateRequest } from "@/lib/user-usage-server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  pack?: DifferentiatedPackContent;
};

const FILES: { key: keyof DifferentiatedPackContent; title: string; base: string }[] = [
  { key: "foundation", title: "Foundation Worksheet", base: "foundation-worksheet" },
  { key: "core", title: "Core Worksheet", base: "core-worksheet" },
  { key: "extension", title: "Extension Worksheet", base: "extension-worksheet" },
  { key: "answerKey", title: "Answer Key (all levels)", base: "answer-key" },
  { key: "rubrics", title: "Marking Rubrics (all levels)", base: "marking-rubrics" },
  { key: "teacherNotes", title: "Teacher Notes", base: "teacher-notes" },
  { key: "selfAssessment", title: "Student Self Assessment Checklist", base: "self-assessment" },
  { key: "peerAssessment", title: "Peer Assessment Sheet", base: "peer-assessment" },
];

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const grade = body.grade?.trim();
  const topic = body.topic?.trim();
  const pack = body.pack;

  if (!subject || !grade || !topic || !pack || typeof pack !== "object") {
    return NextResponse.json(
      { error: "subject, grade, topic, and pack object are required." },
      { status: 400 },
    );
  }

  const zip = new JSZip();
  const base = sanitizeExportFileName(`${grade}-${subject}-${topic}-worksheet-pack`) || "pack";

  for (const f of FILES) {
    const text = pack[f.key]?.trim();
    if (!text) continue;
    const buf = await buildDocxBuffer({
      documentTitle: f.title,
      subject,
      grade,
      topic,
      content: text,
    });
    zip.file(`${base}-${f.base}.docx`, buf);
  }

  if (Object.keys(zip.files).length === 0) {
    return NextResponse.json({ error: "Pack has no non-empty sections to export." }, { status: 400 });
  }

  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${base}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
