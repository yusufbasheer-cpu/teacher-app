import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { error } = await supabase.from("waitlist").insert({ email });

  if (error) {
    console.error("[waitlist] insert failed:", error.message);
    return NextResponse.json({ error: "Failed to save. Please try again." }, { status: 500 });
  }

  console.log("[waitlist] email saved:", email);
  return NextResponse.json({ ok: true });
}
