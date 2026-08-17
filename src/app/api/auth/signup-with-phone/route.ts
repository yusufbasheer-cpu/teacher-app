import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { normalizePhoneDigits, syntheticEmailForPhone } from "@/lib/phone";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Phone-only signup: no SMS provider is configured, so there is no OTP step
// and the phone number itself is never verified — this is a deliberate,
// user-confirmed tradeoff (see conversation), not an oversight. The account
// still needs a real-shaped email for Supabase/Razorpay, so we generate a
// synthetic, guaranteed-undeliverable one (`@phone.invalid`, see phone.ts)
// and create the user pre-confirmed via the admin API — there's no inbox to
// send a confirmation link to.
const GENERIC_ERROR = "Something went wrong creating your account. Please try again.";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`phone-signup:ip:${ip}`, 5, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  let fullName: string | undefined;
  let phone: string | undefined;
  let password: string | undefined;
  try {
    const body = (await req.json()) as { fullName?: string; phone?: string; password?: string };
    fullName = body.fullName?.trim();
    phone = body.phone?.trim();
    password = body.password;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!fullName || !phone || !password) {
    return NextResponse.json({ error: "Name, phone, and password are required." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const digits = normalizePhoneDigits(phone);
  if (digits.length < 7) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const phoneLimit = checkRateLimit(`phone-signup:phone:${digits}`, 3, HOUR_MS);
  if (!phoneLimit.ok) return rateLimitResponse(phoneLimit.resetInSeconds);

  const admin = getSupabaseServiceRole();
  if (!admin) {
    console.error("[signup-with-phone] SUPABASE_SERVICE_ROLE_KEY not configured");
    return NextResponse.json({ error: "Phone signup is not available right now." }, { status: 500 });
  }

  const syntheticEmail = syntheticEmailForPhone(digits);

  const { error: createError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      signup_method: "phone",
    },
  });

  if (createError) {
    const isDuplicate = createError.message?.toLowerCase().includes("already");
    return NextResponse.json(
      {
        error: isDuplicate
          ? "An account with this phone number already exists. Try logging in instead."
          : GENERIC_ERROR,
      },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  });

  if (signInError || !signInData.session) {
    console.error("[signup-with-phone] post-create sign-in failed:", signInError?.message);
    return NextResponse.json(
      { error: "Account created but sign-in failed. Please try logging in." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  });
}
