import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import {
  extractEmailDomain,
  isPersonalEmailDomain,
  normalizeEmailDomain,
  isSchoolPlanType,
} from "@/lib/school-accounts";

export const runtime = "nodejs";

// Readable directly in the browser — uses cookie-based auth (same as school-admin page).
export async function GET() {
  const steps: Record<string, unknown> = {};

  // ── Step 1: Read session from cookies (same method as school-admin/page.tsx) ──
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const email = user?.email?.trim().toLowerCase() ?? null;

  steps["1_auth"] = {
    method: "createServerSupabaseClient (cookie-based)",
    loggedIn: Boolean(user),
    userId,
    email,
  };

  if (!userId || !email) {
    return NextResponse.json(
      { error: "Not logged in — visit layah.in first, then open this URL", steps },
      { status: 401 },
    );
  }

  // ── Step 2: Service role client ──────────────────────────────────────────
  const admin = getSupabaseServiceRole();
  steps["2_service_role"] = {
    ok: Boolean(admin),
    SUPABASE_URL_set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SERVICE_ROLE_KEY_set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY missing in environment", steps },
      { status: 500 },
    );
  }

  // ── Step 3: Domain extraction ────────────────────────────────────────────
  const domain = extractEmailDomain(email);
  const isPersonal = domain ? isPersonalEmailDomain(domain) : null;
  steps["3_domain"] = { email, domain, isPersonal };

  if (!domain || isPersonal) {
    return NextResponse.json(
      {
        error: isPersonal
          ? `"${domain}" is a personal email domain — not eligible for school enrollment`
          : "Could not extract domain from email",
        steps,
      },
      { status: 200 },
    );
  }

  // ── Step 4: school_accounts lookup ───────────────────────────────────────
  const normalized = normalizeEmailDomain(domain);

  const { data: exactSchool, error: exactError } = await admin
    .from("school_accounts")
    .select("id, school_name, plan_type, email_domain, max_teachers, active_teachers, admin_email")
    .eq("email_domain", normalized)
    .maybeSingle();

  steps["4_school_exact_match"] = {
    queried_domain: normalized,
    found: Boolean(exactSchool),
    school: exactSchool ?? null,
    error: exactError?.message ?? null,
  };

  // Fallback: list every school and fuzzy-match
  const { data: allSchools, error: listError } = await admin
    .from("school_accounts")
    .select("id, school_name, plan_type, email_domain, max_teachers, active_teachers");

  const fuzzyMatch = (allSchools ?? []).find(
    (row) =>
      isSchoolPlanType(row.plan_type as string) &&
      normalizeEmailDomain(String(row.email_domain)) === normalized,
  );

  steps["4b_all_schools"] = {
    totalSchools: allSchools?.length ?? 0,
    registeredDomains: (allSchools ?? []).map((s) => s.email_domain),
    fuzzyMatchFound: Boolean(fuzzyMatch),
    fuzzyMatch: fuzzyMatch ?? null,
    listError: listError?.message ?? null,
  };

  const school = exactSchool ?? fuzzyMatch ?? null;

  if (!school) {
    return NextResponse.json(
      {
        error: `No school_accounts row found for domain "${normalized}". Check step 4b for all registered domains.`,
        steps,
      },
      { status: 200 },
    );
  }

  // ── Step 5: Existing school_teachers row ─────────────────────────────────
  const { data: existingRow, error: existingError } = await admin
    .from("school_teachers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  steps["5_existing_membership"] = {
    alreadyInTable: Boolean(existingRow),
    row: existingRow ?? null,
    error: existingError?.message ?? null,
  };

  if (existingRow) {
    return NextResponse.json(
      { message: "✅ Teacher already in school_teachers — enrollment was successful", steps },
      { status: 200 },
    );
  }

  // ── Step 6: Seat capacity ─────────────────────────────────────────────────
  const { count: teacherCount, error: countError } = await admin
    .from("school_teachers")
    .select("id", { count: "exact", head: true })
    .eq("school_account_id", school.id);

  steps["6_seat_check"] = {
    currentCount: teacherCount ?? 0,
    maxTeachers: school.max_teachers,
    hasCapacity: (teacherCount ?? 0) < school.max_teachers,
    error: countError?.message ?? null,
  };

  if ((teacherCount ?? 0) >= school.max_teachers) {
    return NextResponse.json(
      { error: "School is at capacity — max_teachers limit reached", steps },
      { status: 200 },
    );
  }

  // ── Step 7: Attempt upsert ────────────────────────────────────────────────
  const upsertPayload = {
    school_account_id: school.id,
    user_id: userId,
    email,
    generations_used_this_month: 0,
  };

  steps["7_upsert_payload"] = upsertPayload;

  const { data: upsertData, error: upsertError } = await admin
    .from("school_teachers")
    .upsert(upsertPayload, { onConflict: "user_id", ignoreDuplicates: true })
    .select();

  steps["7_upsert_result"] = {
    ok: !upsertError,
    data: upsertData ?? null,
    error: upsertError
      ? {
          code: upsertError.code,
          message: upsertError.message,
          details: upsertError.details,
          hint: upsertError.hint,
        }
      : null,
  };

  // ── Step 8: Verify row landed ─────────────────────────────────────────────
  const { data: verifyRow, error: verifyError } = await admin
    .from("school_teachers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  steps["8_verify_after_upsert"] = {
    rowExists: Boolean(verifyRow),
    row: verifyRow ?? null,
    error: verifyError?.message ?? null,
  };

  return NextResponse.json({
    message: upsertError
      ? "❌ Upsert FAILED — see step 7_upsert_result for the exact Postgres error"
      : verifyRow
        ? "✅ Teacher successfully inserted into school_teachers"
        : "⚠️ Upsert reported no error but row is missing — check for ignoreDuplicates conflict",
    steps,
  });
}
