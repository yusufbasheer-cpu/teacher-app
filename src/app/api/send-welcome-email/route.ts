import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Missing ?email= parameter" }, { status: 400 });
  }

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT?.trim()) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.SMTP_FROM?.trim();

  const envCheck = {
    SMTP_HOST: host || "MISSING",
    SMTP_PORT: port,
    SMTP_USER: user ? "SET" : "MISSING",
    SMTP_PASSWORD: pass ? "SET (hidden)" : "MISSING",
    SMTP_FROM: from || "MISSING",
  };

  if (!host || !user || !pass || !from) {
    return NextResponse.json({
      error: "SMTP not configured",
      envCheck,
    }, { status: 500 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.verify();

    const info = await transporter.sendMail({
      from,
      to: email,
      subject: "Welcome to Layah! Your AI Teaching Assistant is Ready",
      text: [
        "Welcome to Layah!",
        "",
        "We are so excited to have you on board.",
        "You now have access to AI-powered lesson plans, PPTs, worksheets, question papers and more.",
        "",
        "What you can do:",
        "- Generate complete lesson plans in seconds",
        "- Create professional PPT presentations",
        "- Build worksheets and question papers",
        "",
        "Start creating now: https://layah.in/lesson-plan",
        "",
        "Your free plan: 3 generations this month.",
        "Want unlimited access? Upgrade to Pro for just 15 AED/month.",
        "",
        "Happy teaching!",
        "The Layah Team",
        "info@layah.in | layah.in",
      ].join("\n"),
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      sentTo: email,
      envCheck,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
      envCheck,
    }, { status: 500 });
  }
}
