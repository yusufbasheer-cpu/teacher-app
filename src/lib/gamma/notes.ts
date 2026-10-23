import JSZip from "jszip";

/**
 * Gamma's PPTX export already has a notes master and one notes slide per slide, but their body only holds the
 * slide number. This fills each slide's existing notes body with Layah's notes for that physical slide.
 *
 * Safety: the mapping is by presentation order (presentation.xml → slide → its own notesSlide relationship). Any
 * doubt — a different slide count, a slide without its own notes slide, a notes slide shared by two slides, or a
 * notes slide without a body placeholder — rejects the whole insertion; nothing is written partially. Only the body
 * placeholder's paragraphs change; slide content, images, theme and structure are untouched.
 */
export class NotesInsertionError extends Error {}

const escapeXml = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const resolve = (from: string, target: string) => {
  const parts = from.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
};

async function slidePathsInOrder(zip: JSZip): Promise<string[]> {
  const pres = await zip.file("ppt/presentation.xml")?.async("string");
  const rels = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  if (!pres || !rels) throw new NotesInsertionError("Not a PPTX: missing presentation.xml");
  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && target) targets.set(id, target);
  }
  return [...pres.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map((m) => {
    const target = targets.get(m[1]!);
    if (!target) throw new NotesInsertionError(`Slide relationship ${m[1]} is missing`);
    return target.startsWith("/") ? target.slice(1) : `ppt/${target.replace(/^\.?\//, "")}`;
  });
}

async function notesPathFor(zip: JSZip, slidePath: string): Promise<string | null> {
  const relsPath = slidePath.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels");
  const rels = await zip.file(relsPath)?.async("string");
  const rel = rels?.match(/<Relationship\b[^>]*\bType="[^"]*\/notesSlide"[^>]*>/)?.[0];
  const target = rel ? /\bTarget="([^"]+)"/.exec(rel)?.[1] : undefined;
  return target ? resolve(slidePath, target) : null;
}

const BODY_SHAPE_RE = /<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:ph\b[^>]*\btype="body"[\s\S]*?<\/p:sp>/;

export async function insertSpeakerNotes(buffer: Buffer, notes: readonly string[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = await slidePathsInOrder(zip);
  if (slides.length !== notes.length) {
    throw new NotesInsertionError(`Slide count ${slides.length} does not match ${notes.length} notes; refusing an ambiguous mapping`);
  }
  const updates: [string, string][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < slides.length; i++) {
    const notesPath = await notesPathFor(zip, slides[i]!);
    if (!notesPath) throw new NotesInsertionError(`Slide ${i + 1} has no notes slide`);
    if (seen.has(notesPath)) throw new NotesInsertionError(`Notes slide ${notesPath} is shared by two slides`);
    seen.add(notesPath);
    const xml = await zip.file(notesPath)?.async("string");
    const shape = xml?.match(BODY_SHAPE_RE)?.[0];
    const txBody = shape?.match(/<p:txBody>[\s\S]*?<\/p:txBody>/)?.[0];
    if (!xml || !shape || !txBody) throw new NotesInsertionError(`Slide ${i + 1}: notes slide has no body placeholder`);
    const head = txBody.match(/^<p:txBody>\s*(<a:bodyPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:bodyPr>))?\s*(<a:lstStyle\b[^>]*?(?:\/>|>[\s\S]*?<\/a:lstStyle>))?/);
    const paragraphs = notes[i]!
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escapeXml(line)}</a:t></a:r></a:p>`)
      .join("");
    const newTxBody = `<p:txBody>${head?.[1] ?? "<a:bodyPr/>"}${head?.[2] ?? "<a:lstStyle/>"}${paragraphs || "<a:p/>"}</p:txBody>`;
    updates.push([notesPath, xml.replace(shape, () => shape.replace(txBody, () => newTxBody))]);
  }
  for (const [path, xml] of updates) zip.file(path, xml);
  return Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
}

/** The text in each slide's notes body, in presentation order ("" when a slide has none). */
export async function readSpeakerNotes(buffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const out: string[] = [];
  for (const slidePath of await slidePathsInOrder(zip)) {
    const notesPath = await notesPathFor(zip, slidePath);
    const xml = notesPath ? await zip.file(notesPath)?.async("string") : undefined;
    const shape = xml?.match(BODY_SHAPE_RE)?.[0] ?? "";
    out.push([...shape.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)]
      .map((p) => [...p[1]!.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((t) => t[1]!).join(""))
      .map((t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim())
      .filter(Boolean)
      .join("\n"));
  }
  return out;
}
