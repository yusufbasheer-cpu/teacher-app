import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { sendWelcomeEmailIfNew } from "@/lib/welcome-email";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id || !user?.email) {
      console.log("[welcome-email API] No authenticated user found");
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    console.log("[welcome-email API] Triggering welcome email for:", user.email);
    await sendWelcomeEmailIfNew(user.id, user.email, user.user_metadata?.full_name);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[welcome-email API] error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
