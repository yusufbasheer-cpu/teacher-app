import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/send-email";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!await isSuperAdmin(user?.id, user?.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { registrationId, reason } = (await req.json()) as { registrationId: string; reason?: string };
  if (!registrationId) {
    return NextResponse.json({ error: "Missing registrationId" }, { status: 400 });
  }
  const trimmedReason = reason?.trim() ?? "";
  if (!trimmedReason) {
    return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
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

  await admin
    .from("school_registration_requests")
    .update({ status: "rejected", rejection_reason: trimmedReason })
    .eq("id", registrationId);

  await logAdminAction(user!.id, "school.reject", registrationId, {
    school_name: reg.school_name,
    reason: trimmedReason,
  });

  try {
    await sendEmail({
      to: reg.admin_email,
      subject: `School Registration Update - ${reg.school_name}`,
      text: [
        `Dear School Administrator,`,
        ``,
        `Thank you for your interest in Layah.ai for ${reg.school_name}.`,
        ``,
        `After reviewing your registration, we are unable to approve your school account at this time.`,
        ``,
        `Reason: ${trimmedReason}`,
        ``,
        `If you believe this is an error or would like to discuss further, please contact us at info@layah.in.`,
        ``,
        `Best regards,`,
        `The Layah.ai Team`,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #241A12; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #f87171; margin: 0; font-size: 20px;">Registration Update</h1>
          </div>
          <div style="background: #FFFCF7; border: 1px solid #E3D9C8; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p>Dear School Administrator,</p>
            <p>Thank you for your interest in Layah.ai for <strong>${reg.school_name}</strong>.</p>
            <p>After reviewing your registration, we are unable to approve your school account at this time.</p>
            <p><strong>Reason:</strong> ${trimmedReason}</p>
            <p>If you believe this is an error or would like to discuss further, please contact us at <a href="mailto:info@layah.in" style="color: #0E9484;">info@layah.in</a>.</p>
          </div>
        </div>
      `.trim(),
    });
  } catch (err) {
    console.error("[super-admin] rejection email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
