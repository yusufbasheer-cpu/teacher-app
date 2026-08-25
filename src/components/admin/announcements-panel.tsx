"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  Badge,
  EmptyState,
  INK,
  INK_MUTED,
  SectionHeader,
  formatAdminDateTime,
  useActionDialog,
} from "@/components/admin/ui/admin-kit";

type Announcement = {
  id: string;
  title: string;
  body: string;
  segment: string;
  sent_at: string | null;
  recipient_count: number | null;
  created_at: string;
};

const SEGMENTS = [
  { value: "all", label: "All users" },
  { value: "free", label: "Free plan" },
  { value: "pro", label: "Pro plan" },
  { value: "pro_plus", label: "Pro Plus plan" },
  { value: "school", label: "School plans (any tier)" },
] as const;

export function AnnouncementsPanel() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState("all");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const actionDialog = useActionDialog();

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/announcements");
    if (res.ok) setHistory(((await res.json()) as { announcements: Announcement[] }).announcements);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const openSend = () => {
    if (!title.trim() || !body.trim()) return;
    const segmentLabel = SEGMENTS.find((s) => s.value === segment)?.label ?? segment;
    actionDialog.open({
      title: "Send announcement",
      description: "This can't be recalled once sent.",
      confirmLabel: "Send now",
      summary: [
        { label: "To", value: segmentLabel },
        { label: "Subject", value: title },
      ],
      run: async () => {
        setSending(true);
        const res = await fetch("/api/super-admin/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, body, segment }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; sent?: number; attempted?: number };
        setSending(false);
        if (!res.ok) return { ok: false as const, error: data.error ?? "Could not send announcement." };
        setTitle("");
        setBody("");
        await fetchHistory();
        return { ok: true as const, message: `Sent to ${data.sent}/${data.attempted} recipients.` };
      },
    });
  };

  return (
    <section className="space-y-6">
      <div>
        <SectionHeader title="Send Announcement" />
        <AdminCard className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: INK_MUTED }}>Segment</label>
            <AdminSelect value={segment} onChange={(e) => setSegment(e.target.value)}>
              {SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </AdminSelect>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: INK_MUTED }}>Subject</label>
            <AdminInput
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Your Pro plan is expiring soon"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: INK_MUTED }}>Message</label>
            <AdminTextarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Plain text — sent as both the email body and a simple HTML version."
            />
          </div>
          <AdminButton tone="primary" disabled={!title.trim() || !body.trim()} loading={sending} onClick={openSend}>
            Send
          </AdminButton>
        </AdminCard>
      </div>

      <div>
        <SectionHeader title="History" />
        {loading ? (
          <EmptyState title="Loading…" />
        ) : history.length === 0 ? (
          <EmptyState title="No announcements sent yet" />
        ) : (
          <div className="space-y-2">
            {history.map((a) => (
              <AdminCard key={a.id}>
                <p className="font-semibold" style={{ color: INK }}>{a.title}</p>
                <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>{a.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: INK_MUTED }}>
                  <Badge tone="accent">{a.segment}</Badge>
                  <span>{a.recipient_count ?? 0} sent</span>
                  <span>{formatAdminDateTime(a.sent_at ?? a.created_at)}</span>
                </div>
              </AdminCard>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
