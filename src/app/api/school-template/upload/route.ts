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
  // Require auth token
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

  // Parse multipart form
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
    return NextResponse.json({ error: "Template file is too large (max 20 MB)." }, { status: 400 });
  }

  // Extract theme and thumbnail
  let theme;
  let thumbnailBase64: string | null = null;
  try {
    const buffer = await file.arrayBuffer();
    const result = await extractPptxTemplate(buffer);
    theme = result.theme;
    thumbnailBase64 = result.thumbnailBase64;
  } catch (e) {
    console.error("[school-template/upload] extraction error:", e);
    return NextResponse.json(
      { error: "Could not read the .pptx file. Please ensure it is a valid PowerPoint file." },
      { status: 400 },
    );
  }

  // Upsert into school_templates table
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
      },
      { onConflict: "user_id" },
    );

  if (upsertErr) {
    console.error("[school-template/upload] upsert error:", upsertErr);
    return NextResponse.json(
      { error: "Failed to save template. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    originalFilename: file.name,
    thumbnailBase64,
    theme,
  });
}
