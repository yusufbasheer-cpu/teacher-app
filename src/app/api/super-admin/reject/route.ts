import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/send-email";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isSuperAdmin(user?.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { registrationId } = (await req.json()) as { registrationId: string };
  if (!registrationId) {
    return NextResponse.json({ error: "Missing registrationId" }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 500 });
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
    .update({ status: "rejected" })
    .eq("id", registrationId);

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
        `If you believe this is an error or would like to discuss further, please contact us at info@layah.in.`,
        ``,
        `Best regards,`,
        `The Layah.ai Team`,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0A1628; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #f87171; margin: 0; font-size: 20px;">Registration Update</h1>
          </div>
          <div style="background: #ffffff; border: 1px solid #E2E8F0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p>Dear School Administrator,</p>
            <p>Thank you for your interest in Layah.ai for <strong>${reg.school_name}</strong>.</p>
            <p>After reviewing your registration, we are unable to approve your school account at this time.</p>
            <p>If you believe this is an error or would like to discuss further, please contact us at <a href="mailto:info@layah.in" style="color: #00C6A7;">info@layah.in</a>.</p>
          </div>
        </div>
      `.trim(),
    });
  } catch (err) {
    console.error("[super-admin] rejection email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
