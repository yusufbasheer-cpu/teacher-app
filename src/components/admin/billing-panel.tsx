"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminButton,
  AdminCard,
  Badge,
  EmptyState,
  INK,
  INK_MUTED,
  SectionHeader,
  formatAdminDate,
  useActionDialog,
} from "@/components/admin/ui/admin-kit";

type PendingSub = {
  id: string;
  user_id: string;
  userEmail: string;
  razorpay_subscription_id: string;
  status: string;
  current_period_end: string | null;
  updated_at: string;
};

type FailedOrder = {
  id: string;
  user_id: string;
  userEmail: string;
  razorpay_order_id: string;
  amount_paise: number;
  plan_type: string;
  updated_at: string;
};

export function BillingPanel() {
  const [subs, setSubs] = useState<PendingSub[]>([]);
  const [orders, setOrders] = useState<FailedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const actionDialog = useActionDialog();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/razorpay/admin/failed-payments");
    if (res.ok) {
      const data = (await res.json()) as { pendingOrHaltedSubscriptions: PendingSub[]; failedOrders: FailedOrder[] };
      setSubs(data.pendingOrHaltedSubscriptions);
      setOrders(data.failedOrders);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const openRetryNotify = (userId: string, email: string) => {
    actionDialog.open({
      title: "Send payment reminder",
      description: "Razorpay has no way to force-retry the charge itself — this only sends a notification email.",
      confirmLabel: "Send reminder",
      summary: [{ label: "To", value: email }],
      run: async () => {
        setActionLoading(userId);
        const res = await fetch("/api/razorpay/admin/retry-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setActionLoading(null);
        if (!res.ok) return { ok: false as const, error: data.error ?? "Could not send reminder." };
        return { ok: true as const, message: "Reminder sent." };
      },
    });
  };

  return (
    <section>
      <SectionHeader
        title="Billing — Failed / Pending Payments"
        description={`Keyed off the real events Razorpay sends: subscriptions in "pending" (a renewal charge failed, Razorpay is auto-retrying) or "halted" (retries exhausted), plus one-time orders whose payment failed.`}
      />

      {loading ? (
        <EmptyState title="Loading…" />
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold" style={{ color: INK }}>
              Pending / Halted Subscriptions ({subs.length})
            </h3>
            {subs.length === 0 ? (
              <p className="text-sm" style={{ color: INK_MUTED }}>None right now.</p>
            ) : (
              <div className="space-y-2">
                {subs.map((s) => (
                  <AdminCard key={s.id} tone="danger" className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="break-all font-semibold" style={{ color: INK }}>{s.userEmail}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: INK_MUTED }}>
                        <Badge tone="danger">{s.status}</Badge>
                        <span>{s.razorpay_subscription_id}</span>
                        <span>Updated {formatAdminDate(s.updated_at)}</span>
                      </div>
                    </div>
                    <AdminButton tone="secondary" size="sm" loading={actionLoading === s.user_id} onClick={() => openRetryNotify(s.user_id, s.userEmail)}>
                      Send Reminder
                    </AdminButton>
                  </AdminCard>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold" style={{ color: INK }}>
              Failed One-Time Orders ({orders.length})
            </h3>
            {orders.length === 0 ? (
              <p className="text-sm" style={{ color: INK_MUTED }}>None right now.</p>
            ) : (
              <div className="space-y-2">
                {orders.map((o) => (
                  <AdminCard key={o.id} tone="danger" className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="break-all font-semibold" style={{ color: INK }}>{o.userEmail}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: INK_MUTED }}>
                        <span>₹{(o.amount_paise / 100).toFixed(2)} — {o.plan_type}</span>
                        <span>{o.razorpay_order_id}</span>
                        <span>Updated {formatAdminDate(o.updated_at)}</span>
                      </div>
                    </div>
                    <AdminButton tone="secondary" size="sm" loading={actionLoading === o.user_id} onClick={() => openRetryNotify(o.user_id, o.userEmail)}>
                      Send Reminder
                    </AdminButton>
                  </AdminCard>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
