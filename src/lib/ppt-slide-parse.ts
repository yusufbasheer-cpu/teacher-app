/**
 * Pure PPT text parsing (no docx/pptx deps) — safe to import from client components.
 */

export function parsePptContentIntoSlides(raw: string): { title: string; body: string }[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [{ title: "Slide 1", body: "" }];

  const slideStarts = text.split(/\n(?=\s*Slide\s*\d+\s*[:\.\-–]?\s+)/i);
  if (slideStarts.length > 1 || /^\s*Slide\s*\d+/i.test(slideStarts[0]!)) {
    return slideStarts.map((segment, idx) => {
      const seg = segment.trim();
      const lines = seg.split("\n");
      const first = lines[0] ?? "";
      const titleFromFirst = first.replace(/^\s*Slide\s*\d+\s*[:\.\-–]?\s*/i, "").trim();
      const title =
        titleFromFirst.length > 0 && titleFromFirst.length < 120
          ? titleFromFirst
          : `Slide ${idx + 1}`;
      const bodyLines =
        titleFromFirst.length > 0 && titleFromFirst.length < 120 ? lines.slice(1) : lines;
      const body =
        bodyLines.join("\n").trim() || seg.replace(/^\s*Slide\s*\d+\s*[:\.\-–]?\s*/i, "").trim();
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
