import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractPptxTemplate } from "@/lib/pptx-template";
import { sniffFileSignature, scanBufferForMalware } from "@/lib/upload-security";
import { checkRateLimit, getClientIp, HOUR_MS } from "@/lib/rate-limit";
import {
  TEMPLATE_MAX_BYTES,
  TEMPLATE_MAX_MB,
  checkTemplateFile,
  formatFileSize,
  templateUploadIssue,
  type TemplateUploadIssueCode,
} from "@/lib/school-template-upload";

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

/**
 * Every failure carries a stable `code`, a one-sentence `error`, and the `steps` a teacher can
 * follow to fix it, plus the accepted type and size limit, so the UI never has to guess.
 */
function fail(code: TemplateUploadIssueCode, status: number, message?: string, headers?: Record<string, string>) {
  const issue = templateUploadIssue(code, message);
  return NextResponse.json(
    {
      error: issue.message,
      code: issue.code,
      steps: issue.steps,
      accepted: ".pptx",
      maxMb: TEMPLATE_MAX_MB,
    },
    { status, headers },
  );
}

/** Legacy binary Office files (.ppt, and every password-protected Office file) start with this. */
function isLegacyOfficeContainer(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

export async function POST(req: Request) {
  const ipLimit = checkRateLimit(`school-template-upload:ip:${getClientIp(req)}`, 10, HOUR_MS);
  if (!ipLimit.ok) {
    const minutes = Math.max(1, Math.ceil(ipLimit.resetInSeconds / 60));
    return fail(
      "RATE_LIMITED",
      429,
      `You've uploaded several templates in a short time. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      { "Retry-After": String(ipLimit.resetInSeconds) },
    );
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) return fail("SESSION_EXPIRED", 401);

  const supabase = getSupabaseForUser(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return fail("SESSION_EXPIRED", 401);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    // Almost always a dropped connection or a body the platform refused to accept.
    return fail("NETWORK", 400, "We couldn't receive your file. The upload may have been interrupted.");
  }

  const file = formData.get("template");
  if (!file || !(file instanceof File)) return fail("NO_FILE", 400);

  // Same checks the browser runs first; repeated here because the browser can't be trusted.
  const precheck = checkTemplateFile(file);
  if (precheck) return fail(precheck.code, precheck.code === "TOO_LARGE" ? 413 : 400, precheck.message);
  if (file.size > TEMPLATE_MAX_BYTES) return fail("TOO_LARGE", 413);

  console.log(`[school-template/upload] Processing: "${file.name}" (${formatFileSize(file.size)}) for user ${user.id}`);

  const buffer = await file.arrayBuffer();
  const bytes = Buffer.from(buffer);

  // Never trust the extension or client-supplied MIME type — a .pptx is a
  // zip container, so confirm the actual leading bytes are a zip signature
  // before we ever hand it to JSZip.
  if (sniffFileSignature(bytes) !== "zip") {
    if (isLegacyOfficeContainer(bytes)) return fail("OLD_PPT_FORMAT", 400);
    return fail("NOT_A_PRESENTATION", 400);
  }
  // A zip is not necessarily a presentation (a renamed Word file, say). The entry names sit
  // unencrypted in the zip directory, so this finds a real .pptx without unpacking anything.
  if (!bytes.includes("ppt/presentation.xml")) return fail("NOT_A_PRESENTATION", 400);

  const scan = await scanBufferForMalware(bytes, `school-template:${user.id}:${file.name}`);
  if (scan.scanned && !scan.clean) {
    console.error(`[school-template/upload] BLOCKED — malware scan flagged upload for user ${user.id}`);
    return fail("BLOCKED_BY_SCAN", 422);
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
    // The raw reason (zip limits, parse errors) is for the server log, not the teacher.
    console.error("[school-template/upload] Extraction error:", e instanceof Error ? e.message : String(e));
    return fail("UNREADABLE", 400);
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
    // Includes a missing-column migration problem: that is for us to fix, never a teacher's
    // task, so it is logged in full and not shown.
    console.error("[school-template/upload] DB upsert error:", upsertErr);
    return fail("SAVE_FAILED", 500);
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
