import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/send-email";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";
import { escapeHtml, parseContactBody } from "@/lib/contact-form";
import { CONTACT_EMAIL } from "@/lib/site";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ipLimit = await checkRateLimit(`contact:ip:${getClientIp(request)}`, 10, HOUR_MS, "bounded-fallback");
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: a hidden field real visitors never fill. Pretend success so bots
  // get no signal, and send nothing.
  if (typeof (raw as { website?: unknown })?.website === "string" && (raw as { website: string }).website) {
    return NextResponse.json({ ok: true });
  }

  const parsed = parseContactBody(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
  }
  const { name, email, subject, message } = parsed.value;

  // Stop one address from being used to flood the inbox from many IPs.
  const emailLimit = await checkRateLimit(`contact:email:${email.toLowerCase()}`, 3, HOUR_MS, "bounded-fallback");
  if (!emailLimit.ok) return rateLimitResponse(emailLimit.resetInSeconds);

  const result = await sendEmail({
    to: CONTACT_EMAIL,
    replyTo: email,
    subject: `Contact Form: ${subject} — from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>New Contact Form Submission</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-size: 14px;"><strong>Name:</strong></td><td style="padding: 8px 0; font-size: 14px;">${escapeHtml(name)}</td></tr>
          <tr><td style="padding: 8px 0; font-size: 14px;"><strong>Email:</strong></td><td style="padding: 8px 0; font-size: 14px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
          <tr><td style="padding: 8px 0; font-size: 14px;"><strong>Subject:</strong></td><td style="padding: 8px 0; font-size: 14px;">${escapeHtml(subject)}</td></tr>
        </table>
        <div style="margin-top: 16px; padding: 16px; background: #f4f4f5; border-radius: 8px; font-size: 14px; line-height: 1.6;">
          ${escapeHtml(message).replace(/\n/g, "<br>")}
        </div>
      </div>
    `,
  });

  // sendEmail reports failure via its return value (it does not throw), so
  // this check is what stops us telling a visitor "sent" when nothing was.
  if (!result.ok) {
    console.error("[contact] delivery failed:", result.error);
    return NextResponse.json(
      { error: `We couldn't send your message. Please email ${CONTACT_EMAIL} directly.` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
