/**
 * RTL rendering, asserted against the OOXML the renderer actually emits.
 *
 * Deliberately not asserted by mocking pptxgenjs and inspecting the options we passed: that
 * would only prove we called the library a certain way, not that the resulting .pptx carries
 * the paragraph-direction attributes PowerPoint needs. These tests build a real deck and read
 * the XML back out.
 */
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildPptxFromTemplateEngine } from "./ppt-template-engine";
import type { StructuredLessonSlideModel } from "./ppt-structured-lesson";
import { STRUCTURED_LESSON_DECK_SLIDE_COUNT } from "./ppt-structured-lesson";

const AR_TITLE = "نشاط التمهيد";
const AR_BODY = ["اطرح سؤالاً مثيراً للفضول حول دورة الماء.", "ناقش الإجابات مع زميلك لمدة دقيقتين."].join("\n");

function deck(body: string, title: string): StructuredLessonSlideModel[] {
  return Array.from({ length: STRUCTURED_LESSON_DECK_SLIDE_COUNT }, (_, i) => ({
    slideTitle: i === 1 ? title : `Slide ${i + 1}`,
    body,
    speakerNotes: "",
    includeImageSlot: false,
  }));
}

async function slideXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const parts = await Promise.all(names.map((n) => zip.file(n)!.async("string")));
  return parts.join("\n");
}

async function buildArabic(): Promise<string> {
  const buf = await buildPptxFromTemplateEngine({
    templateId: "classic",
    slides: deck(AR_BODY, AR_TITLE),
    subject: "العلوم",
    grade: "الصف الخامس",
    topic: "دورة الماء",
    language: "ar",
  });
  return slideXml(buf);
}

async function buildEnglish(): Promise<string> {
  const buf = await buildPptxFromTemplateEngine({
    templateId: "classic",
    slides: deck("Ask a curious question about the water cycle.", "Starter Activity"),
    subject: "Science",
    grade: "Grade 5",
    topic: "The Water Cycle",
    language: "en",
  });
  return slideXml(buf);
}

describe("Arabic decks", () => {
  it("sets right-to-left paragraph direction, not merely right alignment", async () => {
    const xml = await buildArabic();
    // rtl="1" on the paragraph properties is what orders bullets, numbering and trailing
    // punctuation correctly. Right alignment alone leaves all of that wrong.
    expect(xml).toContain('rtl="1"');
  });

  it("right-aligns body text", async () => {
    const xml = await buildArabic();
    expect(xml).toContain('algn="r"');
  });

  it("tags runs with the Arabic language so PowerPoint shapes and substitutes correctly", async () => {
    const xml = await buildArabic();
    expect(xml).toMatch(/lang="ar-AE"/);
  });

  it("uses an Arabic-capable font rather than the Latin theme face", async () => {
    const xml = await buildArabic();
    expect(xml).toContain("Dubai");
    expect(xml).not.toContain("Calibri");
  });

  it("keeps the Arabic text intact and unromanised", async () => {
    const xml = await buildArabic();
    expect(xml).toContain(AR_TITLE);
    // Arabic must survive as Arabic — never transliterated into Latin characters.
    expect(xml).toContain("دورة الماء");
  });
});

describe("English decks are unaffected", () => {
  it("emits no RTL paragraph direction", async () => {
    const xml = await buildEnglish();
    expect(xml).not.toContain('rtl="1"');
    expect(xml).not.toContain('lang="ar-AE"');
  });

  it("keeps the template's Latin font", async () => {
    const xml = await buildEnglish();
    expect(xml).toContain("Calibri");
    expect(xml).not.toContain("Dubai");
  });

  it("does not right-align body text", async () => {
    const [en, ar] = await Promise.all([buildEnglish(), buildArabic()]);
    const count = (xml: string) => xml.split('algn="r"').length - 1;
    // English decks are not free of `algn="r"` — the footer page number is right-aligned by
    // design, in both languages. What must differ is the body text, so compare counts rather
    // than asserting an absolute absence that was never true.
    expect(count(en)).toBeGreaterThan(0);
    expect(count(ar)).toBeGreaterThan(count(en));
  });
});

describe("static template strings follow the deck language", () => {
  it("renders the continuation eyebrow in Arabic on an Arabic deck", async () => {
    // A very long body forces the renderer to paginate onto a continuation slide.
    const long = Array.from({ length: 60 }, (_, i) => `سطر رقم ${i + 1} من محتوى الدرس الطويل جداً.`).join("\n");
    const buf = await buildPptxFromTemplateEngine({
      templateId: "classic",
      slides: deck(long, AR_TITLE),
      subject: "العلوم",
      grade: "الصف الخامس",
      topic: "دورة الماء",
      language: "ar",
    });
    const xml = await slideXml(buf);
    expect(xml).not.toContain("CONTINUED");
    expect(xml).toContain("تابع");
  });

  it("renders the localised empty-body placeholder rather than the English one", async () => {
    const buf = await buildPptxFromTemplateEngine({
      templateId: "classic",
      slides: deck("", AR_TITLE),
      subject: "العلوم",
      grade: "الصف الخامس",
      topic: "دورة الماء",
      language: "ar",
    });
    const xml = await slideXml(buf);
    expect(xml).not.toContain("No content provided");
    expect(xml).toContain("لا يوجد محتوى");
  });
});
