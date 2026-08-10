import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/send-email";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface ContactBody {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function POST(request: Request) {
  const ipLimit = checkRateLimit(`contact:ip:${getClientIp(request)}`, 10, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  try {
    const body = (await request.json()) as ContactBody;

    if (!body.name || !body.email || !body.subject || !body.message) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    await sendEmail({
      to: "info@layah.in",
      subject: `Contact Form: ${body.subject} — from ${body.name}`,
      text: [
        `Name: ${body.name}`,
        `Email: ${body.email}`,
        `Subject: ${body.subject}`,
        "",
        "Message:",
        body.message,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #241A12;">New Contact Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #7a6e5f; font-size: 14px;"><strong>Name:</strong></td><td style="padding: 8px 0; font-size: 14px;">${body.name}</td></tr>
            <tr><td style="padding: 8px 0; color: #7a6e5f; font-size: 14px;"><strong>Email:</strong></td><td style="padding: 8px 0; font-size: 14px;"><a href="mailto:${body.email}">${body.email}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #7a6e5f; font-size: 14px;"><strong>Subject:</strong></td><td style="padding: 8px 0; font-size: 14px;">${body.subject}</td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f1e9dc; border-radius: 8px; font-size: 14px; line-height: 1.6;">
            ${body.message.replace(/\n/g, "<br>")}
          </div>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] failed to send:", err);
    return NextResponse.json(
      { error: "Failed to send message. Please email info@layah.in directly." },
      { status: 500 },
    );
  }
}
