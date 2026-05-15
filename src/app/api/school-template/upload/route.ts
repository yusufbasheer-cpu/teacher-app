import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractPptxTemplate } from "@/lib/pptx-template";

export const runtime = "nodejs";
export const maxDuration = 30;

function getSupabaseForUser(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  );
}

export async function POST(req: Request) {
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

  const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Template file is too large (max 20 MB)." },
      { status: 400 },
    );
  }

  console.log(`[school-template/upload] Processing template: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);

  let theme;
  let thumbnailBase64: string | null = null;
  let logoBase64: string | null = null;
  try {
    const buffer = await file.arrayBuffer();
    const result = await extractPptxTemplate(buffer);
    theme = result.theme;
    thumbnailBase64 = result.thumbnailBase64;
    logoBase64 = result.logoBase64;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[school-template/upload] Extraction error:", msg);
    return NextResponse.json(
      {
        error: `Could not read the .pptx file: ${msg}. Please ensure it is a valid PowerPoint (.pptx) file.`,
      },
      { status: 400 },
    );
  }

  console.log("[school-template/upload] Upserting into DB for user:", user.id);
  console.log("[school-template/upload] Extracted theme:", theme);
  console.log("[school-template/upload] Logo extracted:", logoBase64 ? `YES (${logoBase64.length} chars)` : "NO");

  const { error: upsertErr } = await supabase
    .from("school_templates")
    .upsert(
      {
        user_id: user.id,
        original_filename: file.name,
        thumbnail_base64: thumbnailBase64,
        primary_color: theme.primaryColor,
        accent_color: theme.accentColor,
        background_color: theme.backgroundColor,
        dark_color: theme.darkColor,
        font_heading: theme.fontHeading,
        font_body: theme.fontBody,
        logo_base64: logoBase64,
      },
      { onConflict: "user_id" },
    );

  if (upsertErr) {
    console.error("[school-template/upload] DB upsert error:", upsertErr);
    return NextResponse.json(
      { error: "Failed to save template to your account. Please try again." },
      { status: 500 },
    );
  }

  console.log("[school-template/upload] Template saved successfully.");

  return NextResponse.json({
    success: true,
    originalFilename: file.name,
    thumbnailBase64,
    logoBase64,
    theme,
  });
}
