import { sendEmail } from "@/lib/send-email";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";

const LAYAH_URL = "https://layah.in";

function buildWelcomeHtml(name: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F9FC;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">

    <!-- Header -->
    <div style="background:#0A1628;padding:32px 40px;text-align:center;">
      <img src="${LAYAH_URL}/Logo.png" alt="Layah" height="40" style="height:40px;width:auto;" />
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <h1 style="color:#0A1628;font-size:24px;font-weight:700;margin:0 0 16px;">
        Welcome to Layah${name ? `, ${name}` : ""}! 🎓
      </h1>
      <p style="color:#4A5568;font-size:15px;line-height:1.6;margin:0 0 24px;">
        We are so excited to have you on board. You now have access to AI-powered lesson plans, PPTs, worksheets, question papers and more — all designed to save you time and make your lessons shine.
      </p>

      <!-- What you can do -->
      <div style="background:#F7F9FC;border-radius:12px;padding:24px;margin-bottom:28px;">
        <p style="color:#0A1628;font-size:14px;font-weight:700;margin:0 0 16px;">What you can do with Layah:</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:28px;">
              <div style="width:24px;height:24px;border-radius:50%;background:rgba(0,198,167,0.15);text-align:center;line-height:24px;font-size:12px;color:#00C6A7;">✓</div>
            </td>
            <td style="padding:8px 0;color:#374151;font-size:14px;">Generate complete lesson plans in seconds</td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:28px;">
              <div style="width:24px;height:24px;border-radius:50%;background:rgba(0,198,167,0.15);text-align:center;line-height:24px;font-size:12px;color:#00C6A7;">✓</div>
            </td>
            <td style="padding:8px 0;color:#374151;font-size:14px;">Create professional PPT presentations</td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:28px;">
              <div style="width:24px;height:24px;border-radius:50%;background:rgba(0,198,167,0.15);text-align:center;line-height:24px;font-size:12px;color:#00C6A7;">✓</div>
            </td>
            <td style="padding:8px 0;color:#374151;font-size:14px;">Build worksheets and question papers</td>
          </tr>
        </table>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${LAYAH_URL}/lesson-plan" style="display:inline-block;background:#00C6A7;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;">
          Start Creating Now
        </a>
      </div>

      <!-- Free plan details -->
      <div style="border:1px solid #E2E8F0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#0A1628;font-size:14px;font-weight:700;margin:0 0 8px;">Your Free Plan</p>
        <p style="color:#4A5568;font-size:14px;line-height:1.5;margin:0;">
          You have <strong style="color:#00C6A7;">3 free generations</strong> this month. Each generation creates a complete lesson plan with PPT, worksheets, and more.
        </p>
      </div>

      <!-- Upgrade -->
      <div style="background:linear-gradient(135deg,#0A1628,#0e2647);border-radius:12px;padding:20px;text-align:center;">
        <p style="color:#ffffff;font-size:14px;font-weight:700;margin:0 0 8px;">Want unlimited access?</p>
        <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0 0 16px;">
          Upgrade to Pro for just <strong style="color:#00C6A7;">15 AED/month</strong> — get 30 generations, all themes, and priority support.
        </p>
        <a href="${LAYAH_URL}/pricing" style="display:inline-block;border:1px solid #00C6A7;color:#00C6A7;font-size:13px;font-weight:600;text-decoration:none;padding:10px 28px;border-radius:8px;">
          View Plans
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#0A1628;padding:24px 40px;text-align:center;">
      <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0 0 8px;">
        <a href="mailto:info@layah.in" style="color:#00C6A7;text-decoration:none;">info@layah.in</a>
        &nbsp;&middot;&nbsp;
        <a href="${LAYAH_URL}" style="color:#00C6A7;text-decoration:none;">layah.in</a>
      </p>
      <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0;">
        &copy; 2026 Layah. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>`;
}

/**
 * Send the welcome email if this user has never received one.
 * Uses a `welcome_email_sent` flag on the `user_usage` row.
 * Safe to call multiple times — only sends once.
 * If user_usage row doesn't exist yet, it creates one first.
 */
export async function sendWelcomeEmailIfNew(
  userId: string,
  email: string,
  displayName?: string,
): Promise<void> {
  console.log(`[welcome-email] Checking welcome email for: ${email} (userId: ${userId})`);

  try {
    const admin = getSupabaseServiceRole();

    const { data: row, error: readErr } = await admin
      .from("user_usage")
      .select("welcome_email_sent")
      .eq("user_id", userId)
      .maybeSingle();

    if (readErr) {
      console.error("[welcome-email] Failed to read user_usage:", readErr.message);
    }

    if (row?.welcome_email_sent) {
      console.log(`[welcome-email] Already sent to ${email}, skipping`);
      return;
    }

    if (!row) {
      console.log(`[welcome-email] No user_usage row yet for ${email} — creating one`);
      const { error: insertErr } = await admin.from("user_usage").upsert(
        {
          user_id: userId,
          plan_type: "free",
          generations_used: 0,
          generations_limit: 3,
          reset_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
          welcome_email_sent: false,
        },
        { onConflict: "user_id" },
      );
      if (insertErr) {
        console.error("[welcome-email] Failed to upsert user_usage:", insertErr.message);
      }
    }

    const firstName = displayName?.split(" ")[0] ?? "";

    console.log(`[welcome-email] Sending welcome email to: ${email}`);

    const result = await sendEmail({
      to: email,
      subject: "Welcome to Layah! Your AI Teaching Assistant is Ready 🎓",
      text: [
        `Welcome to Layah${firstName ? `, ${firstName}` : ""}!`,
        "",
        "We are so excited to have you on board. You now have access to AI-powered lesson plans, PPTs, worksheets, question papers and more.",
        "",
        "What you can do:",
        "- Generate complete lesson plans in seconds",
        "- Create professional PPT presentations",
        "- Build worksheets and question papers",
        "",
        `Start creating now: ${LAYAH_URL}/lesson-plan`,
        "",
        "Your free plan: 3 generations this month.",
        "Want unlimited access? Upgrade to Pro for just 15 AED/month.",
        "",
        `View plans: ${LAYAH_URL}/pricing`,
        "",
        "Happy teaching!",
        "The Layah Team",
        "info@layah.in | layah.in",
      ].join("\n"),
      html: buildWelcomeHtml(firstName),
    });

    if (result.ok) {
      console.log(`[welcome-email] Welcome email sent successfully to ${email}`);
      const { error: updateErr } = await admin
        .from("user_usage")
        .update({ welcome_email_sent: true })
        .eq("user_id", userId);
      if (updateErr) {
        console.error("[welcome-email] Failed to update welcome_email_sent flag:", updateErr.message);
      }
    } else {
      console.error(`[welcome-email] Welcome email failed for ${email}: ${result.error}`);
    }
  } catch (err) {
    console.error("[welcome-email] Unexpected error:", err);
  }
}
