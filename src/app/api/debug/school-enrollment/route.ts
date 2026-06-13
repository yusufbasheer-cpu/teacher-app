import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { findSchoolForAdmin } from "@/lib/school-admin-server";
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

  // ── Step 1: Session from cookies ─────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const email = user?.email?.trim().toLowerCase() ?? null;

  steps["1_auth"] = { loggedIn: Boolean(user), userId, email };

  if (!userId || !email) {
    return NextResponse.json(
      { error: "Not logged in — visit layah.in first, then open this URL", steps },
      { status: 401 },
    );
  }

  const admin = getSupabaseServiceRole();
  steps["2_service_role"] = {
    ok: Boolean(admin),
    SUPABASE_URL_set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SERVICE_ROLE_KEY_set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY missing", steps }, { status: 500 });
  }

  // ── Step 3: ALL rows in school_teachers (no filter) ───────────────────────
  const { data: allTeacherRows, error: allTeachersError } = await admin
    .from("school_teachers")
    .select("id, user_id, email, school_account_id, joined_at");

  steps["3_all_school_teachers_rows"] = {
    totalRows: allTeacherRows?.length ?? 0,
    rows: allTeacherRows ?? [],
    error: allTeachersError?.message ?? null,
  };

  // ── Step 4: ALL rows in school_accounts ───────────────────────────────────
  const { data: allSchools, error: allSchoolsError } = await admin
    .from("school_accounts")
    .select("id, school_name, email_domain, admin_email, plan_type, max_teachers, active_teachers");

  steps["4_all_school_accounts_rows"] = {
    totalRows: allSchools?.length ?? 0,
    rows: allSchools ?? [],
    error: allSchoolsError?.message ?? null,
  };

  // ── Step 5: findSchoolForAdmin — exact same lookup as school-admin page ───
  const schoolForAdmin = await findSchoolForAdmin(email);

  steps["5_findSchoolForAdmin"] = {
    queriedAdminEmail: email,
    found: Boolean(schoolForAdmin),
    school: schoolForAdmin
      ? { id: schoolForAdmin.id, name: schoolForAdmin.school_name, adminEmail: schoolForAdmin.admin_email }
      : null,
  };

  // ── Step 6: ID mismatch diagnosis ────────────────────────────────────────
  const adminSchoolId = schoolForAdmin?.id ?? null;
  const teacherRow = (allTeacherRows ?? []).find((r) => r.user_id === userId);

  steps["6_id_mismatch_check"] = {
    your_user_id: userId,
    your_email: email,
    school_teachers_row_found: Boolean(teacherRow),
    school_account_id_in_teachers_row: teacherRow?.school_account_id ?? null,
    school_id_from_findSchoolForAdmin: adminSchoolId,
    ids_match: teacherRow ? teacherRow.school_account_id === adminSchoolId : null,
    diagnosis: !teacherRow
      ? "❌ No row in school_teachers for your user_id"
      : teacherRow.school_account_id === adminSchoolId
        ? "✅ IDs match — query should work"
        : `❌ ID MISMATCH — school_teachers has school_account_id=${teacherRow.school_account_id} but findSchoolForAdmin returned id=${adminSchoolId}`,
  };

  // ── Step 7: Domain-based school lookup (enrollment path) ─────────────────
  const domain = extractEmailDomain(email);
  const isPersonal = domain ? isPersonalEmailDomain(domain) : null;
  steps["7_domain_check"] = { domain, isPersonal };

  if (domain && !isPersonal) {
    const normalized = normalizeEmailDomain(domain);
    const { data: domainSchool } = await admin
      .from("school_accounts")
      .select("id, school_name, email_domain")
      .eq("email_domain", normalized)
      .maybeSingle();

    const fuzzy = (allSchools ?? []).find(
      (r) => isSchoolPlanType(r.plan_type as string) && normalizeEmailDomain(String(r.email_domain)) === normalized,
    );

    steps["7b_school_by_domain"] = {
      normalizedDomain: normalized,
      exactMatch: domainSchool ?? null,
      fuzzyMatch: fuzzy ?? null,
    };
  }

  return NextResponse.json({ steps });
}
