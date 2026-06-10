import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/send-email";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type FeedbackBody = {
  name: string;
  email: string;
  role: string;
  rating: number;
  message: string;
};

const STARS = (n: number) => "★".repeat(Math.max(1, Math.min(5, n))) + "☆".repeat(5 - Math.max(1, Math.min(5, n)));

export async function POST(req: Request) {
  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, email, role, rating, message } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "Feedback message is required." }, { status: 400 });
  }

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    console.error("[feedback] Supabase service role client unavailable.");
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }
  const { error: dbError } = await supabase.from("feedback").insert({
    name: name?.trim() || null,
    email: email?.trim() || null,
    role: role?.trim() || null,
    rating: typeof rating === "number" ? rating : null,
    message: message.trim(),
  });

  if (dbError) {
    console.error("[feedback] db insert failed:", dbError.message);
    return NextResponse.json({ error: "Failed to save feedback." }, { status: 500 });
  }

  try {
    await sendEmail({
      to: "info@layah.in",
      subject: `New Feedback from ${name?.trim() || "Anonymous"} — ${STARS(rating)}`,
      text: [
        `Name: ${name || "—"}`,
        `Email: ${email || "—"}`,
        `Role: ${role || "—"}`,
        `Rating: ${STARS(rating)} (${rating}/5)`,
        "",
        "Message:",
        message,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #0A1628;">New Feedback Submission 💬</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;"><strong>Name:</strong></td><td style="padding: 8px 0; font-size: 14px;">${name || "—"}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;"><strong>Email:</strong></td><td style="padding: 8px 0; font-size: 14px;">${email ? `<a href="mailto:${email}">${email}</a>` : "—"}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;"><strong>Role:</strong></td><td style="padding: 8px 0; font-size: 14px;">${role || "—"}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;"><strong>Rating:</strong></td><td style="padding: 8px 0; font-size: 18px; color: #F59E0B;">${STARS(rating)} <span style="font-size: 14px; color: #374151;">(${rating}/5)</span></td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f8fafc; border-radius: 8px; font-size: 14px; line-height: 1.6;">
            ${message.replace(/\n/g, "<br>")}
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error("[feedback] email send failed:", err);
    // DB save succeeded — don't fail the request over email
  }

  return NextResponse.json({ ok: true });
}
