import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/send-email";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RegistrationBody = {
  adminEmail: string;
  adminUserId?: string;
  schoolName: string;
  emailDomain: string;
  country: string;
  numTeachers: string;
  phone: string;
  howHeard: string;
  planSelected: string;
  planPrice: string;
};

export async function POST(req: Request) {
  let body: RegistrationBody;
  try {
    body = (await req.json()) as RegistrationBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const {
    adminEmail,
    adminUserId,
    schoolName,
    emailDomain,
    country,
    numTeachers,
    phone,
    howHeard,
    planSelected,
    planPrice,
  } = body;

  if (!adminEmail || !schoolName || !emailDomain || !country || !numTeachers || !planSelected) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    console.error("[school-register] SUPABASE_SERVICE_ROLE_KEY not configured");
    return NextResponse.json(
      { error: "Server configuration error: service role key missing." },
      { status: 500 },
    );
  }

  const insertPayload = {
    admin_email: adminEmail.trim().toLowerCase(),
    admin_user_id: adminUserId || null,
    school_name: schoolName.trim(),
    email_domain: emailDomain.trim().toLowerCase(),
    country: country.trim(),
    num_teachers: numTeachers,
    phone: (phone ?? "").trim(),
    how_heard: (howHeard ?? "").trim(),
    plan_selected: planSelected,
    plan_price: (planPrice ?? "").trim(),
    status: "pending",
  };

  console.log("[school-register] insert payload:", JSON.stringify(insertPayload, null, 2));

  const { data: insertData, error: insertError } = await admin
    .from("school_registration_requests")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (insertError) {
    console.error("[school-register] insert failed:", {
      message: insertError.message,
      code: insertError.code,
      details: insertError.details,
      hint: insertError.hint,
    });
    return NextResponse.json(
      {
        error: `Could not save registration: ${insertError.message}`,
        code: insertError.code,
        hint: insertError.hint ?? null,
      },
      { status: 500 },
    );
  }

  console.log("[school-register] saved successfully, id:", insertData?.id);

  try {
    await sendNotificationEmail({
      adminEmail,
      schoolName,
      emailDomain,
      country,
      numTeachers,
      phone,
      howHeard,
      planSelected,
      planPrice,
    });
  } catch (err) {
    console.error("[school-register] notification email failed:", err);
  }

  return NextResponse.json({ ok: true });
}

async function sendNotificationEmail(data: Omit<RegistrationBody, "adminUserId">) {
  const subject = `New School Registration - ${data.schoolName}`;

  const text = [
    "New School Registration Request",
    "================================",
    "",
    `School Name:        ${data.schoolName}`,
    `Email Domain:       @${data.emailDomain}`,
    `Plan Selected:      ${data.planSelected}`,
    `Price:              ${data.planPrice || "N/A"}`,
    `Number of Teachers: ${data.numTeachers}`,
    `Country:            ${data.country}`,
    `Phone:              ${data.phone || "Not provided"}`,
    `Admin Email:        ${data.adminEmail}`,
    `How They Heard:     ${data.howHeard || "Not provided"}`,
    "",
    `Submitted at:       ${new Date().toISOString()}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0A1628; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #00C6A7; margin: 0; font-size: 20px;">New School Registration</h1>
        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 14px;">A new school has registered on Layah.ai</p>
      </div>
      <div style="background: #ffffff; border: 1px solid #E2E8F0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #F1F5F9;">
            <td style="padding: 12px 8px; color: #64748b; font-weight: 600;">School Name</td>
            <td style="padding: 12px 8px; color: #0A1628; font-weight: 700;">${data.schoolName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F1F5F9;">
            <td style="padding: 12px 8px; color: #64748b; font-weight: 600;">Email Domain</td>
            <td style="padding: 12px 8px; color: #0A1628;">@${data.emailDomain}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F1F5F9;">
            <td style="padding: 12px 8px; color: #64748b; font-weight: 600;">Plan Selected</td>
            <td style="padding: 12px 8px; color: #00C6A7; font-weight: 700;">${data.planSelected}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F1F5F9;">
            <td style="padding: 12px 8px; color: #64748b; font-weight: 600;">Price</td>
            <td style="padding: 12px 8px; color: #0A1628;">${data.planPrice || "N/A"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F1F5F9;">
            <td style="padding: 12px 8px; color: #64748b; font-weight: 600;">Number of Teachers</td>
            <td style="padding: 12px 8px; color: #0A1628;">${data.numTeachers}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F1F5F9;">
            <td style="padding: 12px 8px; color: #64748b; font-weight: 600;">Country</td>
            <td style="padding: 12px 8px; color: #0A1628;">${data.country}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F1F5F9;">
            <td style="padding: 12px 8px; color: #64748b; font-weight: 600;">Phone</td>
            <td style="padding: 12px 8px; color: #0A1628;">${data.phone || "Not provided"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F1F5F9;">
            <td style="padding: 12px 8px; color: #64748b; font-weight: 600;">Admin Email</td>
            <td style="padding: 12px 8px; color: #0A1628;">${data.adminEmail}</td>
          </tr>
          <tr>
            <td style="padding: 12px 8px; color: #64748b; font-weight: 600;">How They Heard</td>
            <td style="padding: 12px 8px; color: #0A1628;">${data.howHeard || "Not provided"}</td>
          </tr>
        </table>
        <p style="margin: 20px 0 0; font-size: 12px; color: #94a3b8;">
          Submitted at ${new Date().toISOString()}
        </p>
      </div>
    </div>
  `.trim();

  const result = await sendEmail({
    to: "info@layah.in",
    subject,
    text,
    html,
  });

  if (!result.ok) {
    console.warn("[school-register] notification email not sent:", result.error);
  }
}
