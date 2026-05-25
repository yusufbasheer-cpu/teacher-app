import { NextResponse } from "next/server";
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
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { error: insertError } = await admin
    .from("school_registration_requests")
    .insert({
      admin_email: adminEmail.trim().toLowerCase(),
      admin_user_id: adminUserId || null,
      school_name: schoolName.trim(),
      email_domain: emailDomain.trim().toLowerCase(),
      country: country.trim(),
      num_teachers: numTeachers,
      phone: phone.trim(),
      how_heard: howHeard.trim(),
      plan_selected: planSelected,
      plan_price: planPrice,
      status: "pending",
    });

  if (insertError) {
    console.error("[school-register] insert failed:", insertError.message);
    return NextResponse.json({ error: "Could not save registration." }, { status: 500 });
  }

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
  const admin = getSupabaseServiceRole();
  if (!admin) return;

  const subject = `New School Registration: ${data.schoolName}`;
  const body = [
    `School Name: ${data.schoolName}`,
    `Admin Email: ${data.adminEmail}`,
    `Email Domain: ${data.emailDomain}`,
    `Country: ${data.country}`,
    `Number of Teachers: ${data.numTeachers}`,
    `Phone: ${data.phone || "Not provided"}`,
    `How They Heard: ${data.howHeard || "Not provided"}`,
    `Plan Selected: ${data.planSelected}`,
    `Price: ${data.planPrice || "N/A"}`,
    "",
    `Submitted at: ${new Date().toISOString()}`,
  ].join("\n");

  const { error } = await admin.functions.invoke("send-email", {
    body: {
      to: "yusuf.basheer@gmail.com",
      subject,
      text: body,
    },
  });

  if (error) {
    console.warn("[school-register] Edge function send-email failed:", error.message);
    console.log("[school-register] Would have sent email to yusuf.basheer@gmail.com:");
    console.log(body);
  }
}
