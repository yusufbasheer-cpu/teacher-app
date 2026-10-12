import JSZip from "jszip";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Only the database and the signed-in user are faked; the checks, the real .pptx extractor and the
// error wording all run for real.
const upsert = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from: () => ({ upsert }),
  }),
}));

import { buildPptxFromPptContent } from "@/lib/lesson-plan-export";
import { POST } from "./route";

let ipCounter = 0;
async function upload(file: File | null, token: string | null = "token") {
  const form = new FormData();
  if (file) form.append("template", file);
  const headers: Record<string, string> = { "x-forwarded-for": `10.9.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await POST(new Request("http://localhost/api/school-template/upload", { method: "POST", headers, body: form }));
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const file = (name: string, bytes: Uint8Array | Buffer | string) => new File([bytes as BlobPart], name);

let realDeck: Buffer;
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  realDeck = await buildPptxFromPptContent({
    subject: "ICT",
    grade: "Grade 10",
    topic: "Applying ICT",
    pptContent: "x",
    structuredSlides: Array.from({ length: 13 }, (_, i) => ({
      slideTitle: `Slide ${i + 1}`,
      body: "- one\n- two",
      speakerNotes: "",
      includeImageSlot: false,
    })),
  });
}, 60000);

beforeEach(() => upsert.mockReset().mockResolvedValue({ error: null }));

describe("POST /api/school-template/upload", () => {
  it("saves a real .pptx and returns the extracted theme", async () => {
    const { status, body } = await upload(file("School Template.pptx", realDeck));
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.originalFilename).toBe("School Template.pptx");
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("explains what to do for a file of the wrong type", async () => {
    const { status, body } = await upload(file("template.pdf", "%PDF-1.4 hello"));
    expect(status).toBe(400);
    expect(body.code).toBe("WRONG_FILE_TYPE");
    expect(body.accepted).toBe(".pptx");
    expect(body.maxMb).toBe(15);
    expect((body.steps as string[]).length).toBeGreaterThan(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("recognises an old .ppt that was renamed to .pptx", async () => {
    const legacy = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(200)]);
    const { status, body } = await upload(file("old.pptx", legacy));
    expect(status).toBe(400);
    expect(body.code).toBe("OLD_PPT_FORMAT");
  });

  it("rejects a zip that is not a presentation (a renamed Word file, say)", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "<w:document/>");
    const docx = await zip.generateAsync({ type: "nodebuffer" });
    const { status, body } = await upload(file("notes.pptx", docx));
    expect(status).toBe(400);
    expect(body.code).toBe("NOT_A_PRESENTATION");
  });

  it("rejects text that only has a .pptx name", async () => {
    const { body } = await upload(file("fake.pptx", "just some text"));
    expect(body.code).toBe("NOT_A_PRESENTATION");
  });

  it("states the size limit and the actual size for an oversized file", async () => {
    const big = new File([new Uint8Array(16 * 1024 * 1024)], "huge.pptx");
    const { status, body } = await upload(big);
    expect(status).toBe(413);
    expect(body.code).toBe("TOO_LARGE");
    expect(body.error).toContain("16.0 MB");
    expect(body.error).toContain("15 MB");
  });

  it("rejects an empty file", async () => {
    const { body } = await upload(file("empty.pptx", ""));
    expect(body.code).toBe("EMPTY_FILE");
  });

  it("asks for a file when none was sent", async () => {
    const { status, body } = await upload(null);
    expect(status).toBe(400);
    expect(body.code).toBe("NO_FILE");
  });

  it("tells a signed-out user to log in again", async () => {
    const { status, body } = await upload(file("a.pptx", realDeck), null);
    expect(status).toBe(401);
    expect(body.code).toBe("SESSION_EXPIRED");
  });

  it("never shows database details when saving fails", async () => {
    upsert.mockResolvedValue({ error: { message: 'column "file_data" of relation "school_templates" does not exist' } });
    const { status, body } = await upload(file("a.pptx", realDeck));
    expect(status).toBe(500);
    expect(body.code).toBe("SAVE_FAILED");
    expect(JSON.stringify(body)).not.toMatch(/column|relation|school_templates|ALTER/i);
  });

  it("stops repeated uploads from one address with a clear wait time", async () => {
    const headers = { "x-forwarded-for": "203.0.113.77", Authorization: "Bearer t" };
    let last = { status: 0, code: "" };
    for (let i = 0; i < 12; i++) {
      const form = new FormData();
      form.append("template", file("t.pdf", "%PDF"));
      const response = await POST(new Request("http://localhost/x", { method: "POST", headers, body: form }));
      const body = (await response.json()) as { code?: string };
      last = { status: response.status, code: body.code ?? "" };
    }
    expect(last).toEqual({ status: 429, code: "RATE_LIMITED" });
  });
});
