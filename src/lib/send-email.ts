import nodemailer from "nodemailer";

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT?.trim()) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.SMTP_FROM?.trim();

  if (!host || !user || !pass || !from) {
    return null;
  }

  return { host, port, user, pass, from };
}

type SendEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(options: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  const config = getSmtpConfig();

  if (!config) {
    console.warn("[send-email] SMTP not configured (missing SMTP_HOST, SMTP_USER, SMTP_PASSWORD, or SMTP_FROM)");
    console.log("[send-email] Would have sent:", { to: options.to, subject: options.subject });
    return { ok: false, error: "SMTP not configured" };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log("[send-email] sent successfully, messageId:", info.messageId);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-email] failed:", message);
    return { ok: false, error: message };
  }
}
