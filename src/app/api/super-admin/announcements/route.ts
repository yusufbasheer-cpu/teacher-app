import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { hasPermission, isAdminUser } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { logAdminAction } from "@/lib/audit-log";
import { sendEmail } from "@/lib/send-email";

export const runtime = "nodejs";
export const maxDuration = 300; // sequential sends for a large segment can take a while

type Segment = "all" | "free" | "pro" | "pro_plus" | "school";

type Body = { title?: string; body?: string; segment?: Segment };

function matchesSegment(planType: string, segment: Segment): boolean {
  if (segment === "all") return true;
  if (segment === "school") return planType.startsWith("school_");
  return planType === segment;
}

/** GET: history. POST: send now (confirm-step is the UI's responsibility, this is the real send). */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[super-admin/announcements] DB error:", error.message);
    return NextResponse.json({ error: "Could not load announcements." }, { status: 500 });
  }

  return NextResponse.json({ announcements: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdminUser(user?.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (!(await hasPermission(user?.id, "notifications.broadcast"))) {
    return NextResponse.json({ error: "You don't have permission to send broadcasts." }, { status: 403 });
  }

  const { title, body, segment } = (await req.json()) as Body;
  const trimmedTitle = title?.trim() ?? "";
  const trimmedBody = body?.trim() ?? "";
  const seg: Segment = segment && ["all", "free", "pro", "pro_plus", "school"].includes(segment) ? segment : "all";

  if (!trimmedTitle || !trimmedBody) {
    return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  }

  const [{ data: authUsers }, { data: usageRows }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 10000 }),
    admin.from("user_usage").select("user_id, plan_type"),
  ]);

  const planByUserId = new Map((usageRows ?? []).map((r) => [r.user_id as string, (r.plan_type as string) ?? "free"]));
  const recipients = (authUsers?.users ?? []).filter((u) => u.email && matchesSegment(planByUserId.get(u.id) ?? "free", seg));

  const { data: announcement, error: insertError } = await admin
    .from("announcements")
    .insert({ title: trimmedTitle, body: trimmedBody, segment: seg, sent_by: user!.id })
    .select("id")
    .single();

  if (insertError || !announcement) {
    console.error("[super-admin/announcements] insert failed:", insertError?.message);
    return NextResponse.json({ error: "Could not create announcement." }, { status: 500 });
  }

  let sentCount = 0;
  for (const recipient of recipients) {
    const result = await sendEmail({
      to: recipient.email!,
      subject: trimmedTitle,
      text: trimmedBody,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><p>${trimmedBody.replace(/\n/g, "<br>")}</p></div>`,
    });
    if (result.ok) sentCount += 1;
  }

  await admin
    .from("announcements")
    .update({ sent_at: new Date().toISOString(), recipient_count: sentCount })
    .eq("id", announcement.id);

  await logAdminAction(user!.id, "notification.broadcast_send", announcement.id, {
    segment: seg,
    attempted: recipients.length,
    sent: sentCount,
  });

  return NextResponse.json({ ok: true, sent: sentCount, attempted: recipients.length });
}
