import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { normalizePhoneDigits } from "@/lib/phone";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Phone isn't a real Supabase auth identity here (no SMS provider is
// configured) — it's captured as user_metadata.phone at signup. Logging in
// by phone means: find the account whose metadata phone matches, then run
// the normal email/password sign-in server-side with the service role.
// listUsers() has no server-side metadata filter, so this scans pages of
// users; fine at current scale, revisit (e.g. a dedicated phone->user_id
// table) if the user base grows large enough for this to matter.
const MAX_PAGES = 20;
const PAGE_SIZE = 200;
const GENERIC_ERROR = "Invalid phone number or password.";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`phone-login:ip:${ip}`, 10, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  let phone: string | undefined;
  let password: string | undefined;
  try {
    const body = (await req.json()) as { phone?: string; password?: string };
    phone = body.phone?.trim();
    password = body.password;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!phone || !password) {
    return NextResponse.json({ error: "Phone and password are required." }, { status: 400 });
  }

  const targetDigits = normalizePhoneDigits(phone);
  if (targetDigits.length < 7) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const phoneLimit = checkRateLimit(`phone-login:phone:${targetDigits}`, 10, HOUR_MS);
  if (!phoneLimit.ok) return rateLimitResponse(phoneLimit.resetInSeconds);

  const admin = getSupabaseServiceRole();
  if (!admin) {
    console.error("[login-with-phone] SUPABASE_SERVICE_ROLE_KEY not configured");
    return NextResponse.json({ error: "Phone login is not available right now." }, { status: 500 });
  }

  let matchedEmail: string | null = null;
  for (let page = 1; page <= MAX_PAGES && !matchedEmail; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      console.error("[login-with-phone] listUsers failed:", error.message);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }

    for (const user of data.users) {
      const candidate = (user.user_metadata as Record<string, unknown> | null)?.phone;
      if (typeof candidate === "string" && candidate && normalizePhoneDigits(candidate) === targetDigits) {
        matchedEmail = user.email ?? null;
        break;
      }
    }

    if (data.users.length < PAGE_SIZE) break;
  }

  if (!matchedEmail) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
    email: matchedEmail,
    password,
  });

  if (signInError || !signInData.session) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  return NextResponse.json({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  });
}
