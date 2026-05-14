import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseForUser(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  );
}

function getToken(req: Request): string | null {
  return req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? null;
}

/** GET — fetch saved school template for the logged-in user. */
export async function GET(req: Request) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = getSupabaseForUser(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const { data, error } = await supabase
    .from("school_templates")
    .select(
      "original_filename, thumbnail_base64, primary_color, accent_color, background_color, dark_color, font_heading, font_body, created_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[school-template] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch template." }, { status: 500 });
  }

  return NextResponse.json({ template: data ?? null });
}

/** DELETE — remove saved school template for the logged-in user. */
export async function DELETE(req: Request) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = getSupabaseForUser(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const { error } = await supabase
    .from("school_templates")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("[school-template] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete template." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
