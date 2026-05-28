import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/send-email";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Missing ?email= parameter" }, { status: 400 });
  }

  const result = await sendEmail({
    to: email,
    subject: "Welcome to Layah! Your AI Teaching Assistant is Ready 🎓",
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

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, sentTo: email });
}
