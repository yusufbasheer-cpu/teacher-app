"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminSelect,
  Badge,
  EmptyState,
  FONT_MONO,
  INK,
  INK_FAINT,
  INK_MUTED,
  BORDER,
  ACCENT,
  DANGER,
  SectionHeader,
  formatAdminDate,
  formatPlanLabel,
  useActionDialog,
  useToast,
} from "@/components/admin/ui/admin-kit";

type UserRow = {
  id: string;
  email: string;
  createdAt: string;
  planType: string;
  generationsUsed: number;
  generationsLimit: number;
  accountStatus: "active" | "suspended";
};

type UserDetail = {
  user: { id: string; email: string; createdAt: string; lastSignInAt: string | null };
  usage: Record<string, unknown> | null;
  generationEvents: {
    id: string;
    generation_type: string;
    status: string;
    plan_type: string;
    metered: boolean;
    duration_ms: number | null;
    created_at: string;
  }[];
  auditHistory: { id: string; admin_user_id: string; action: string; details: unknown; created_at: string }[];
  orders: Record<string, unknown>[];
  subscriptions: SubscriptionRow[];
};

type SubscriptionRow = {
  id: string;
  razorpay_subscription_id: string;
  status: string;
  current_period_end: string | null;
  trial_end_at: string | null;
  active_offer_id: string | null;
};

type PaymentRow = {
  source: "order" | "subscription";
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  createdAt: number;
};

const PLAN_OPTIONS = ["free", "pro", "pro_plus", "school_starter", "school_pro", "school_enterprise"] as const;

async function postJson(url: string, body?: unknown, method: "POST" | "DELETE" = "POST") {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!res.ok) return { ok: false as const, error: data.error ?? "Something went wrong.", data };
  return { ok: true as const, data };
}

export function UsersPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [sort, setSort] = useState("created_desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPlan, setBulkPlan] = useState("pro");

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [impersonateLink, setImpersonateLink] = useState<{ email: string; url: string } | null>(null);

  const actionDialog = useActionDialog();
  const toast = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort });
    if (search.trim()) params.set("search", search.trim());
    if (planFilter) params.set("plan", planFilter);
    const res = await fetch(`/api/super-admin/users?${params.toString()}`);
    if (res.ok) setUsers(((await res.json()) as { users: UserRow[] }).users);
    setLoading(false);
  }, [search, planFilter, sort]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadUserDetail = async (userId: string) => {
    setDetail(null);
    setPayments([]);
    setDetailLoading(true);
    const res = await fetch(`/api/super-admin/users/${userId}`);
    if (res.ok) {
      const data = (await res.json()) as UserDetail;
      setDetail(data);
      if (data.orders.length > 0 || data.subscriptions.length > 0) {
        setPaymentsLoading(true);
        const payRes = await fetch(`/api/razorpay/admin/users/${userId}/payments`);
        if (payRes.ok) setPayments(((await payRes.json()) as { payments: PaymentRow[] }).payments);
        setPaymentsLoading(false);
      }
    }
    setDetailLoading(false);
  };

  const toggleExpanded = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setDetail(null);
      setPayments([]);
      return;
    }
    setExpandedUserId(userId);
    await loadUserDetail(userId);
  };

  // ---- Money-moving / destructive actions, all via the ledger dialog ------

  const openRefund = (userId: string, paymentId: string, amountPaise: number) => {
    actionDialog.open({
      title: "Issue refund",
      tone: "danger",
      description: "This moves real money and cannot be undone.",
      confirmLabel: "Issue refund",
      summary: [
        { label: "Payment", value: paymentId },
        { label: "Captured amount", value: `₹${(amountPaise / 100).toFixed(2)}` },
      ],
      fields: [
        { kind: "amount", key: "amount", label: "Refund amount (₹)", maxPaise: amountPaise },
        { kind: "reason" },
      ],
      run: async (values) => {
        const amount = values.amount ? Math.round(Number(values.amount) * 100) : undefined;
        setActionLoading(paymentId);
        const result = await postJson("/api/razorpay/admin/refund", { userId, paymentId, amount, reason: values.reason });
        setActionLoading(null);
        if (!result.ok) return result;
        await loadUserDetail(userId);
        return { ok: true, message: `${amount ? "Partial" : "Full"} refund issued for ${paymentId}.` };
      },
    });
  };

  const openGrantTrial = (userId: string) => {
    actionDialog.open({
      title: "Grant trial",
      description: "Applied on their next checkout, since checkout is self-serve.",
      confirmLabel: "Grant trial",
      fields: [{ kind: "text", key: "trialDays", label: "Trial length in days", placeholder: "e.g. 14" }],
      run: async (values) => {
        const trialDays = Number(values.trialDays);
        if (!trialDays || trialDays <= 0) return { ok: false as const, error: "Enter a positive number of days." };
        setActionLoading(userId);
        const result = await postJson("/api/razorpay/admin/trial/grant", { userId, trialDays });
        setActionLoading(null);
        if (!result.ok) return result;
        return { ok: true, message: `Trial granted — next charge delayed by ${trialDays} day(s).` };
      },
    });
  };

  const openPauseSubscription = (userId: string, subscriptionRowId: string) => {
    actionDialog.open({
      title: "Pause subscription",
      tone: "danger",
      description: "No charges will occur while paused. Razorpay doesn't support scheduling an automatic resume — you'll resume this manually.",
      confirmLabel: "Pause now",
      fields: [
        { kind: "text", key: "intendedResumeAt", label: "Intended resume date (informational only)", placeholder: "YYYY-MM-DD" },
        { kind: "reason" },
      ],
      run: async (values) => {
        setActionLoading(subscriptionRowId);
        const result = await postJson(`/api/razorpay/admin/subscription/${subscriptionRowId}/pause`, {
          intendedResumeAt: values.intendedResumeAt || null,
          reason: values.reason,
        });
        setActionLoading(null);
        if (!result.ok) return result;
        await loadUserDetail(userId);
        return { ok: true, message: "Subscription paused." };
      },
    });
  };

  const openResumeSubscription = (userId: string, subscriptionRowId: string) => {
    actionDialog.open({
      title: "Resume subscription",
      confirmLabel: "Resume",
      description: "Normal billing resumes immediately.",
      run: async () => {
        setActionLoading(subscriptionRowId);
        const result = await postJson(`/api/razorpay/admin/subscription/${subscriptionRowId}/resume`);
        setActionLoading(null);
        if (!result.ok) return result;
        await loadUserDetail(userId);
        return { ok: true, message: "Subscription resumed." };
      },
    });
  };

  const openApplyOffer = (userId: string, subscriptionRowId: string) => {
    actionDialog.open({
      title: "Apply offer",
      description: "Create the offer in the Razorpay Dashboard first — there's no API to create or list offers. Takes effect at the customer's NEXT billing cycle, not immediately.",
      confirmLabel: "Apply offer",
      fields: [{ kind: "text", key: "offerId", label: "Razorpay offer_id", placeholder: "offer_..." }],
      run: async (values) => {
        if (!values.offerId?.trim()) return { ok: false as const, error: "Enter an offer_id." };
        setActionLoading(subscriptionRowId);
        const result = await postJson(`/api/razorpay/admin/subscription/${subscriptionRowId}/offer`, { offerId: values.offerId.trim() });
        setActionLoading(null);
        if (!result.ok) return result;
        await loadUserDetail(userId);
        return { ok: true, message: (result.data.note as string | undefined) ?? "Offer applied." };
      },
    });
  };

  const handleChangePlan = async (userId: string, planType: string) => {
    setActionLoading(userId);
    const result = await postJson("/api/super-admin/change-plan", { userId, planType });
    setActionLoading(null);
    if (!result.ok) toast.error(result.error);
    else await fetchUsers();
  };

  const openSuspend = (userId: string, email: string) => {
    actionDialog.open({
      title: "Suspend account",
      tone: "danger",
      confirmLabel: "Suspend",
      summary: [{ label: "User", value: email }],
      fields: [{ kind: "reason" }],
      run: async (values) => {
        setActionLoading(userId);
        const result = await postJson(`/api/super-admin/users/${userId}/suspend`, { reason: values.reason });
        setActionLoading(null);
        if (!result.ok) return result;
        await fetchUsers();
        return { ok: true, message: `${email} suspended.` };
      },
    });
  };

  const handleUnsuspend = async (userId: string) => {
    setActionLoading(userId);
    const result = await postJson(`/api/super-admin/users/${userId}/unsuspend`);
    setActionLoading(null);
    if (!result.ok) toast.error(result.error);
    else await fetchUsers();
  };

  const openResetQuota = (userId: string, email: string) => {
    actionDialog.open({
      title: "Reset quota",
      confirmLabel: "Reset to 0",
      summary: [{ label: "User", value: email }],
      run: async () => {
        setActionLoading(userId);
        const result = await postJson(`/api/super-admin/users/${userId}/reset-quota`);
        setActionLoading(null);
        if (!result.ok) return result;
        await fetchUsers();
        return { ok: true, message: "Quota reset." };
      },
    });
  };

  const openResendVerification = (userId: string, email: string) => {
    actionDialog.open({
      title: "Confirm email",
      description: "This confirms the email directly rather than sending a new link.",
      confirmLabel: "Confirm email",
      summary: [{ label: "User", value: email }],
      run: async () => {
        setActionLoading(userId);
        const result = await postJson(`/api/super-admin/users/${userId}/resend-verification`);
        setActionLoading(null);
        if (!result.ok) return result;
        return { ok: true, message: "Email confirmed." };
      },
    });
  };

  const openResendReset = (userId: string, email: string) => {
    actionDialog.open({
      title: "Send password reset",
      confirmLabel: "Send email",
      summary: [{ label: "User", value: email }],
      run: async () => {
        setActionLoading(userId);
        const result = await postJson(`/api/super-admin/users/${userId}/resend-reset`);
        setActionLoading(null);
        if (!result.ok) return result;
        return { ok: true, message: "Reset email sent." };
      },
    });
  };

  const openImpersonate = (userId: string, email: string) => {
    actionDialog.open({
      title: "Impersonate user",
      tone: "danger",
      confirmLabel: "Start session",
      summary: [{ label: "User", value: email }],
      fields: [{ kind: "reason" }],
      run: async (values) => {
        setActionLoading(userId);
        const result = await postJson(`/api/super-admin/users/${userId}/impersonate`, { reason: values.reason });
        setActionLoading(null);
        if (!result.ok) return result;
        const actionLink = (result.data.actionLink as string | undefined) ?? "";
        if (!actionLink) return { ok: false as const, error: "No session link returned." };
        setImpersonateLink({ email, url: actionLink });
        return { ok: true, message: "Impersonation session created." };
      },
    });
  };

  const openDelete = (userId: string, email: string) => {
    actionDialog.open({
      title: "Delete user",
      tone: "danger",
      description: "This cannot be undone.",
      confirmLabel: "Delete permanently",
      summary: [{ label: "User", value: email }],
      fields: [{ kind: "typedMatch", key: "confirmEmail", mustEqual: email, label: `Type "${email}" to confirm` }],
      run: async () => {
        setActionLoading(userId);
        const result = await postJson(`/api/super-admin/users/${userId}`, undefined, "DELETE");
        setActionLoading(null);
        if (!result.ok) return result;
        await fetchUsers();
        return { ok: true, message: `${email} deleted.` };
      },
    });
  };

  const openBulkChangePlan = () => {
    if (selected.size === 0) return;
    actionDialog.open({
      title: "Change plan for selected users",
      confirmLabel: "Apply to selected",
      summary: [
        { label: "Users", value: String(selected.size) },
        { label: "New plan", value: formatPlanLabel(bulkPlan) },
      ],
      run: async () => {
        setActionLoading("bulk");
        const result = await postJson("/api/super-admin/users/bulk/change-plan", { userIds: Array.from(selected), planType: bulkPlan });
        setActionLoading(null);
        if (!result.ok) return result;
        setSelected(new Set());
        await fetchUsers();
        return { ok: true, message: `${selected.size} user(s) moved to ${formatPlanLabel(bulkPlan)}.` };
      },
    });
  };

  return (
    <section>
      <SectionHeader
        title={`All Users (${users.length})`}
        action={
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- this is a file download from an API route, not a page navigation
          <a
            href="/api/super-admin/users/export"
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:bg-black/[0.02]"
            style={{ borderColor: BORDER, color: INK }}
          >
            Export CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <AdminInput
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email…"
          className="min-w-[200px] flex-1"
        />
        <AdminSelect value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="w-auto">
          <option value="">All plans</option>
          {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{formatPlanLabel(p)}</option>)}
        </AdminSelect>
        <AdminSelect value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto">
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="email_asc">Email A–Z</option>
          <option value="generations_desc">Most generations used</option>
        </AdminSelect>
      </div>

      {selected.size > 0 && (
        <AdminCard className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: INK }}>{selected.size} selected</span>
          <AdminSelect value={bulkPlan} onChange={(e) => setBulkPlan(e.target.value)} className="w-auto">
            {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{formatPlanLabel(p)}</option>)}
          </AdminSelect>
          <AdminButton tone="primary" loading={actionLoading === "bulk"} onClick={openBulkChangePlan}>
            Apply to selected
          </AdminButton>
          <AdminButton tone="ghost" onClick={() => setSelected(new Set())}>Clear selection</AdminButton>
        </AdminCard>
      )}

      {loading ? (
        <EmptyState title="Loading…" />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <AdminCard key={u.id} padded={false} tone={u.accountStatus === "suspended" ? "danger" : "default"}>
              <div className="flex flex-wrap items-center gap-3 p-4">
                <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelected(u.id)} />
                <div className="min-w-[180px] flex-1">
                  <button
                    type="button"
                    onClick={() => void toggleExpanded(u.id)}
                    className="break-all text-left font-semibold hover:underline"
                    style={{ color: INK }}
                  >
                    {u.email}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: INK_MUTED }}>
                    <Badge tone="accent">{formatPlanLabel(u.planType)}</Badge>
                    <span className={FONT_MONO}>{u.generationsUsed}/{u.generationsLimit === -1 ? "∞" : u.generationsLimit}</span>
                    <span>{formatAdminDate(u.createdAt)}</span>
                    {u.accountStatus === "suspended" && <Badge tone="danger">Suspended</Badge>}
                  </div>
                </div>

                <AdminSelect
                  value={u.planType}
                  disabled={actionLoading === u.id}
                  onChange={(e) => void handleChangePlan(u.id, e.target.value)}
                  className="w-auto py-1.5 text-xs"
                >
                  {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{formatPlanLabel(p)}</option>)}
                </AdminSelect>

                <div className="flex flex-wrap gap-1.5">
                  {u.accountStatus === "suspended" ? (
                    <AdminButton tone="positive" size="sm" loading={actionLoading === u.id} onClick={() => void handleUnsuspend(u.id)}>
                      Unsuspend
                    </AdminButton>
                  ) : (
                    <AdminButton tone="danger" size="sm" loading={actionLoading === u.id} onClick={() => openSuspend(u.id, u.email)}>
                      Suspend
                    </AdminButton>
                  )}
                  <AdminButton tone="secondary" size="sm" loading={actionLoading === u.id} onClick={() => openResetQuota(u.id, u.email)}>
                    Reset Quota
                  </AdminButton>
                  <AdminButton tone="secondary" size="sm" loading={actionLoading === u.id} onClick={() => openImpersonate(u.id, u.email)}>
                    Impersonate
                  </AdminButton>
                  <AdminButton tone="danger" size="sm" loading={actionLoading === u.id} onClick={() => openDelete(u.id, u.email)}>
                    Delete
                  </AdminButton>
                </div>
              </div>

              {expandedUserId === u.id && (
                <div className="px-4 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                  {detailLoading ? (
                    <p className="text-sm" style={{ color: INK_MUTED }}>Loading details…</p>
                  ) : !detail ? (
                    <p className="text-sm" style={{ color: INK_MUTED }}>Could not load details.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <AdminButton tone="secondary" size="sm" loading={actionLoading === u.id} onClick={() => openResendVerification(u.id, u.email)}>
                          Confirm Email
                        </AdminButton>
                        <AdminButton tone="secondary" size="sm" loading={actionLoading === u.id} onClick={() => openResendReset(u.id, u.email)}>
                          Send Password Reset
                        </AdminButton>
                      </div>

                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: INK_FAINT }}>
                          Recent generations ({detail.generationEvents.length})
                        </p>
                        {detail.generationEvents.length === 0 ? (
                          <p className="text-xs" style={{ color: INK_FAINT }}>None yet.</p>
                        ) : (
                          <div className="max-h-40 overflow-y-auto rounded-lg text-xs" style={{ background: "#FAFAF8" }}>
                            {detail.generationEvents.map((ev) => (
                              <div key={ev.id} className="flex justify-between gap-2 px-2 py-1.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                                <span>{ev.generation_type}</span>
                                <span style={{ color: ev.status === "failed" ? DANGER : ACCENT }}>{ev.status}</span>
                                <span style={{ color: INK_FAINT }}>{formatAdminDate(ev.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: INK_FAINT }}>
                          Admin action history ({detail.auditHistory.length})
                        </p>
                        {detail.auditHistory.length === 0 ? (
                          <p className="text-xs" style={{ color: INK_FAINT }}>None yet.</p>
                        ) : (
                          <div className="max-h-40 overflow-y-auto rounded-lg text-xs" style={{ background: "#FAFAF8" }}>
                            {detail.auditHistory.map((a) => (
                              <div key={a.id} className="flex justify-between gap-2 px-2 py-1.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                                <span>{a.action}</span>
                                <span style={{ color: INK_FAINT }}>{formatAdminDate(a.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: INK_FAINT }}>
                          Subscription management
                        </p>
                        {(() => {
                          const activeSub = detail.subscriptions.find((s) => s.status === "active");
                          const pausedSub = detail.subscriptions.find((s) => s.status === "paused");
                          const hasAnySub = detail.subscriptions.some((s) => ["active", "pending", "created", "paused"].includes(s.status));
                          return (
                            <div className="flex flex-wrap gap-2">
                              {!hasAnySub && (
                                <AdminButton tone="secondary" size="sm" loading={actionLoading === u.id} onClick={() => openGrantTrial(u.id)}>
                                  Grant Trial (next checkout)
                                </AdminButton>
                              )}
                              {activeSub && (
                                <>
                                  <AdminButton tone="danger" size="sm" loading={actionLoading === activeSub.id} onClick={() => openPauseSubscription(u.id, activeSub.id)}>
                                    Pause Subscription
                                  </AdminButton>
                                  <AdminButton tone="secondary" size="sm" loading={actionLoading === activeSub.id} onClick={() => openApplyOffer(u.id, activeSub.id)}>
                                    Apply Offer{activeSub.active_offer_id ? ` (current: ${activeSub.active_offer_id})` : ""}
                                  </AdminButton>
                                </>
                              )}
                              {pausedSub && (
                                <AdminButton tone="positive" size="sm" loading={actionLoading === pausedSub.id} onClick={() => openResumeSubscription(u.id, pausedSub.id)}>
                                  Resume Subscription
                                </AdminButton>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: INK_FAINT }}>
                          Payments — live from Razorpay ({payments.length})
                        </p>
                        {paymentsLoading ? (
                          <p className="text-xs" style={{ color: INK_FAINT }}>Loading payment history from Razorpay…</p>
                        ) : payments.length === 0 ? (
                          <p className="text-xs" style={{ color: INK_FAINT }}>No orders or subscriptions for this user.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {payments.map((p) => (
                              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "#FAFAF8" }}>
                                <div>
                                  <span className={`font-medium ${FONT_MONO}`} style={{ color: INK }}>
                                    {p.currency} {(p.amount / 100).toFixed(2)}
                                  </span>
                                  <span className="ml-2" style={{ color: INK_MUTED }}>
                                    {p.id} · {p.source} · {p.status} · {p.method ?? ""} · {p.createdAt ? formatAdminDate(new Date(p.createdAt * 1000).toISOString()) : ""}
                                  </span>
                                </div>
                                {p.status === "captured" || p.status === "paid" ? (
                                  <AdminButton tone="danger" size="sm" loading={actionLoading === p.id} onClick={() => openRefund(u.id, p.id, p.amount)}>
                                    Refund
                                  </AdminButton>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </AdminCard>
          ))}
        </div>
      )}

      {impersonateLink && (
        <Dialog open onOpenChange={(o) => !o && setImpersonateLink(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle style={{ color: INK }}>Impersonation link ready</DialogTitle>
            </DialogHeader>
            <p className="text-sm" style={{ color: INK_MUTED }}>
              Open this in an <strong>incognito/private window</strong> — opening it in a normal tab will also log you out of your own admin session. Link is for {impersonateLink.email}.
            </p>
            <div className="flex items-center gap-2">
              <AdminInput readOnly value={impersonateLink.url} className={FONT_MONO + " text-xs"} onFocus={(e) => e.currentTarget.select()} />
              <AdminButton
                tone="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(impersonateLink.url);
                  toast.success("Link copied.");
                }}
              >
                <Copy className="size-3.5" />
                Copy
              </AdminButton>
            </div>
            <DialogFooter>
              <AdminButton tone="ghost" onClick={() => setImpersonateLink(null)}>Close</AdminButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
