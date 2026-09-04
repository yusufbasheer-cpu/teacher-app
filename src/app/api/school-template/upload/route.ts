import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractPptxTemplate } from "@/lib/pptx-template";
import { sniffFileSignature, scanBufferForMalware } from "@/lib/upload-security";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Strips control characters and caps length before a client-supplied
 *  filename is stored/echoed back — it's never used as a path, but it is
 *  persisted and returned in JSON, so it should still never carry raw
 *  control characters (including CR/LF). */
function sanitizeDisplayFilename(name: string): string {
  let out = "";
  for (let i = 0; i < name.length && out.length < 200; i++) {
    const code = name.charCodeAt(i);
    if (code >= 0x20 && code !== 0x7f) out += name[i];
  }
  return out.trim() || "template.pptx";
}

function getSupabaseForUser(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  );
}

export async function POST(req: Request) {
  const ipLimit = checkRateLimit(`school-template-upload:ip:${getClientIp(req)}`, 10, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseForUser(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Failed to parse form data." }, { status: 400 });
  }

  const file = formData.get("template");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No template file provided." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".pptx")) {
    return NextResponse.json({ error: "Only .pptx files are accepted." }, { status: 400 });
  }

  const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Template file is too large (max 15 MB). Please use a smaller template." },
      { status: 400 },
    );
  }

  console.log(`[school-template/upload] Processing: "${file.name}" (${(file.size / 1024).toFixed(1)} KB) for user ${user.id}`);

  const buffer = await file.arrayBuffer();
  const bytes = Buffer.from(buffer);

  // Never trust the extension or client-supplied MIME type — a .pptx is a
  // zip container, so confirm the actual leading bytes are a zip signature
  // before we ever hand it to JSZip.
  if (sniffFileSignature(bytes) !== "zip") {
    return NextResponse.json(
      { error: "This doesn't look like a valid .pptx file (unexpected file signature)." },
      { status: 400 },
    );
  }

  const scan = await scanBufferForMalware(bytes, `school-template:${user.id}:${file.name}`);
  if (scan.scanned && !scan.clean) {
    console.error(`[school-template/upload] BLOCKED — malware scan flagged upload for user ${user.id}`);
    return NextResponse.json({ error: "This file failed a security scan and was rejected." }, { status: 422 });
  }
  if (!scan.scanned) {
    // No scanner is provisioned for this project (see scanBufferForMalware).
    // Safe to proceed unscanned because this buffer is only ever parsed as
    // theme/media metadata (JSZip + regex over XML) and stored as inert
    // bytes — never executed, never served to another user, never unzipped
    // to a real filesystem path.
    console.warn(`[school-template/upload] proceeding WITHOUT malware scan for user ${user.id}: ${scan.reason}`);
  }

  // ── Extract theme colours, fonts, logo, thumbnail ─────────────────────────
  let theme;
  let thumbnailBase64: string | null = null;
  let logoBase64: string | null = null;
  try {
    const result = await extractPptxTemplate(buffer);
    theme        = result.theme;
    thumbnailBase64 = result.thumbnailBase64;
    logoBase64   = result.logoBase64;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[school-template/upload] Extraction error:", msg);
    return NextResponse.json(
      { error: `Could not read the .pptx file: ${msg}. Please ensure it is a valid PowerPoint (.pptx) file.` },
      { status: 400 },
    );
  }

  // ── Encode the full .pptx file as base64 so we can re-use it later ─────────
  const fileData = Buffer.from(buffer).toString("base64");
  console.log("[school-template/upload] file_data base64 length:", fileData.length);
  console.log("[school-template/upload] Extracted theme:", theme);
  console.log("[school-template/upload] Logo:", logoBase64 ? "YES" : "NO");

  // ── Upsert into school_templates ──────────────────────────────────────────
  const { error: upsertErr } = await supabase
    .from("school_templates")
    .upsert(
      {
        user_id:          user.id,
        original_filename: sanitizeDisplayFilename(file.name),
        thumbnail_base64:  thumbnailBase64,
        primary_color:     theme.primaryColor,
        accent_color:      theme.accentColor,
        background_color:  theme.backgroundColor,
        dark_color:        theme.darkColor,
        font_heading:      theme.fontHeading,
        font_body:         theme.fontBody,
        logo_base64:       logoBase64,
        file_data:         fileData,
      },
      { onConflict: "user_id" },
    );

  if (upsertErr) {
    console.error("[school-template/upload] DB upsert error:", upsertErr);

    // If the error is about missing columns, give a clear migration message
    const isMissingColumn =
      upsertErr.message?.includes("column") &&
      (upsertErr.message.includes("logo_base64") || upsertErr.message.includes("file_data"));

    if (isMissingColumn) {
      return NextResponse.json(
        {
          error:
            "Database migration required. Please run the following SQL in your Supabase SQL editor:\n" +
            "ALTER TABLE school_templates ADD COLUMN IF NOT EXISTS logo_base64 TEXT;\n" +
            "ALTER TABLE school_templates ADD COLUMN IF NOT EXISTS file_data TEXT;",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Failed to save template to your account. Please try again." },
      { status: 500 },
    );
  }

  console.log("[school-template/upload] Template saved successfully.");

  return NextResponse.json({
    success: true,
    originalFilename: sanitizeDisplayFilename(file.name),
    thumbnailBase64,
    logoBase64,
    theme,
  });
}
