import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/send-email";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { planIdByAdminLabel } from "@/lib/plans";

export const runtime = "nodejs";

const TEACHER_MAP: Record<string, number> = {
  "Up to 10": 10,
  "Up to 30": 30,
  "Unlimited": 999,
};

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!await isSuperAdmin(user?.id, user?.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { registrationId } = (await req.json()) as { registrationId: string };
  if (!registrationId) {
    return NextResponse.json({ error: "Missing registrationId" }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data: reg, error: fetchError } = await admin
    .from("school_registration_requests")
    .select("*")
    .eq("id", registrationId)
    .maybeSingle();

  if (fetchError || !reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const planType = planIdByAdminLabel(reg.plan_selected) ?? "school_starter";
  const maxTeachers = TEACHER_MAP[reg.num_teachers] ?? 10;

  const { error: insertError } = await admin.from("school_accounts").insert({
    school_name: reg.school_name,
    email_domain: reg.email_domain,
    plan_type: planType,
    max_teachers: maxTeachers,
    active_teachers: 0,
    admin_email: reg.admin_email,
    status: "active",
  });

  if (insertError) {
    console.error("[super-admin/approve] insert failed:", insertError.message);
    return NextResponse.json({ error: "Could not activate school. Please try again." }, { status: 500 });
  }

  await admin
    .from("school_registration_requests")
    .update({ status: "approved" })
    .eq("id", registrationId);

  await logAdminAction(user!.id, "school.approve", registrationId, {
    school_name: reg.school_name,
    plan_type: planType,
  });

  try {
    await sendEmail({
      to: reg.admin_email,
      subject: `Your School Account is Activated - ${reg.school_name}`,
      text: [
        `Dear School Administrator,`,
        ``,
        `Great news! Your school account for ${reg.school_name} has been approved and activated on Layah.ai.`,
        ``,
        `Account Details:`,
        `- School Name: ${reg.school_name}`,
        `- Plan: ${reg.plan_selected}`,
        `- Email Domain: @${reg.email_domain}`,
        `- Max Teachers: ${maxTeachers === 999 ? "Unlimited" : maxTeachers}`,
        ``,
        `Teachers with @${reg.email_domain} email addresses can now sign in with Google to automatically join your school plan.`,
        ``,
        `You can manage your school at: https://layah.in/school-admin`,
        ``,
        `Best regards,`,
        `The Layah.ai Team`,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: var(--text); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: var(--brand); margin: 0; font-size: 20px;">School Account Activated!</h1>
          </div>
          <div style="background: var(--surface-raised); border: 1px solid var(--border); border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p>Dear School Administrator,</p>
            <p>Great news! Your school account for <strong>${reg.school_name}</strong> has been approved and activated.</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0;">
              <tr style="border-bottom: 1px solid var(--canvas);">
                <td style="padding: 10px 8px; color: var(--text-secondary);">School Name</td>
                <td style="padding: 10px 8px; color: var(--text); font-weight: 700;">${reg.school_name}</td>
              </tr>
              <tr style="border-bottom: 1px solid var(--canvas);">
                <td style="padding: 10px 8px; color: var(--text-secondary);">Plan</td>
                <td style="padding: 10px 8px; color: var(--brand); font-weight: 700;">${reg.plan_selected}</td>
              </tr>
              <tr style="border-bottom: 1px solid var(--canvas);">
                <td style="padding: 10px 8px; color: var(--text-secondary);">Email Domain</td>
                <td style="padding: 10px 8px; color: var(--text);">@${reg.email_domain}</td>
              </tr>
              <tr>
                <td style="padding: 10px 8px; color: var(--text-secondary);">Max Teachers</td>
                <td style="padding: 10px 8px; color: var(--text);">${maxTeachers === 999 ? "Unlimited" : maxTeachers}</td>
              </tr>
            </table>
            <p>Teachers with <strong>@${reg.email_domain}</strong> email addresses can now sign in with Google to automatically join your school plan.</p>
            <p><a href="https://layah.in/school-admin" style="color: var(--brand);">Manage your school →</a></p>
          </div>
        </div>
      `.trim(),
    });
  } catch (err) {
    console.error("[super-admin] approval email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
