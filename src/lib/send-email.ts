import nodemailer from "nodemailer";

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.SMTP_FROM?.trim();

  if (!host || !user || !pass || !from) {
    return null;
  }

  return { host, user, pass, from };
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
    console.warn("[send-email] SMTP not configured. Env check:", {
      SMTP_HOST: process.env.SMTP_HOST ? "SET" : "MISSING",
      SMTP_USER: process.env.SMTP_USER ? "SET" : "MISSING",
      SMTP_PASSWORD: process.env.SMTP_PASSWORD ? "SET" : "MISSING",
      SMTP_FROM: process.env.SMTP_FROM ? "SET" : "MISSING",
    });
    console.log("[send-email] Would have sent:", { to: options.to, subject: options.subject });
    return { ok: false, error: "SMTP not configured" };
  }

  console.log("[send-email] SMTP configured:", { host: config.host, port: 587, from: config.from });

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: 587,
    secure: false,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `Layah <${config.from}>`,
      replyTo: config.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      headers: {
        "X-Mailer": "Layah App",
      },
    });

    console.log("[send-email] sent successfully, messageId:", info.messageId);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-email] failed:", message);
    return { ok: false, error: message };
  }
}
