"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { getAuthHeaders } from "@/lib/auth-headers";
import { supabase } from "@/lib/supabase";
import type { UserUsageSnapshot } from "@/lib/user-usage";

const NAVY = "#241A12";
const TEAL = "#0E9484";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro Plus",
  school_starter: "School Starter",
  school_pro: "School Pro",
  school_enterprise: "School Enterprise",
};

type SubscriptionInfo = {
  status: "created" | "active" | "pending" | "halted" | "cancelled";
  current_period_end: string | null;
  cancel_at_cycle_end: boolean;
};

function CancelConfirmModal({
  onConfirm,
  onCancel,
  cancelling,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#241A12]/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-sm rounded-3xl border bg-[#FAF6EF] p-8 shadow-2xl"
        style={{ borderColor: "rgba(14, 148, 132,0.3)" }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-sub-title"
      >
        <h2 id="cancel-sub-title" className="text-center text-xl font-bold" style={{ color: NAVY }}>
          Cancel auto-renewal?
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
          You&apos;ll keep Pro access until the end of your current billing period. No further
          payments will be taken after that.
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={cancelling}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {cancelling ? "Cancelling…" : "Yes, Cancel Auto-Renewal"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border text-sm font-semibold transition hover:bg-stone-50 disabled:opacity-60"
            style={{ borderColor: "#D9CCB8", color: "#6B5D4F" }}
          >
            Keep Subscription
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  onConfirm,
  onCancel,
  deleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#241A12]/70 backdrop-blur-sm"
        aria-label="Cancel"
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-sm rounded-3xl border bg-[#FAF6EF] p-8 shadow-2xl"
        style={{ borderColor: "rgba(239,68,68,0.3)" }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <svg className="size-7 text-red-500" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2 id="delete-confirm-title" className="text-center text-xl font-bold" style={{ color: NAVY }}>
          Are you sure?
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
          This will permanently delete your account and all your lesson plans, question papers, and worksheets.
          <strong className="block mt-1 text-red-600">This action cannot be undone.</strong>
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Yes, Delete My Account"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border text-sm font-semibold transition hover:bg-stone-50 disabled:opacity-60"
            style={{ borderColor: "#D9CCB8", color: "#6B5D4F" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [usage, setUsage] = useState<UserUsageSnapshot | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const didInit = useRef(false);

  const loadSubscription = async () => {
    try {
      const res = await fetch("/api/razorpay/subscription", {
        headers: await getAuthHeaders(),
        cache: "no-store",
      });
      const data = (await res.json()) as { subscription?: SubscriptionInfo | null };
      setSubscription(data.subscription ?? null);
    } catch {
      /* subscription section is optional */
    }
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      setEmail(session.user.email ?? null);

      try {
        const res = await fetch("/api/user-usage", {
          headers: await getAuthHeaders(),
          cache: "no-store",
        });
        const data = (await res.json()) as { usage?: UserUsageSnapshot };
        if (data.usage) setUsage(data.usage);
      } catch {
        /* usage optional */
      }

      await loadSubscription();
      setLoadingPage(false);
    };

    void init();
  }, [router]);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadSuccess(false);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/account/export", { headers, cache: "no-store" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "layah-my-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch {
      /* silent — browser already shows network errors */
    } finally {
      setDownloading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    setCancelError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/razorpay/cancel-subscription", { method: "POST", headers });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setCancelError(data.error ?? "Something went wrong. Please try again.");
        setCancelling(false);
        return;
      }

      await loadSubscription();
      setShowCancelModal(false);
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setDeleteError(data.error ?? "Something went wrong. Please try again.");
        setDeleting(false);
        return;
      }

      await supabase.auth.signOut();
      router.replace("/");
    } catch {
      setDeleteError("Something went wrong. Please try again.");
      setDeleting(false);
    }
  };

  if (loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm font-medium" style={{ color: "#7a6e5f" }}>Loading…</p>
      </main>
    );
  }

  const planLabel = usage ? (PLAN_LABELS[usage.planType] ?? usage.planType) : "—";
  const generationsText = usage
    ? usage.unlimited
      ? "Unlimited"
      : `${usage.generationsUsed} of ${usage.generationsLimit ?? "?"} used this month`
    : "—";

  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <div className="mx-auto max-w-xl">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            Account Settings
          </h1>
          <p className="mt-2 text-sm" style={{ color: "#6B5D4F" }}>
            Manage your Layah account and data.
          </p>

          {/* Account details */}
          <section
            className="mt-8 rounded-3xl border bg-[#FAF6EF] p-6 shadow-sm"
            style={{ borderColor: "rgba(14, 148, 132,0.2)" }}
          >
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: TEAL }}>
              Account Details
            </h2>
            <dl className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: "#F1E9DC" }}>
                <dt className="text-sm font-medium" style={{ color: "#7a6e5f" }}>Email</dt>
                <dd className="text-sm font-semibold" style={{ color: NAVY }}>{email ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: "#F1E9DC" }}>
                <dt className="text-sm font-medium" style={{ color: "#7a6e5f" }}>Plan</dt>
                <dd className="text-sm font-semibold" style={{ color: NAVY }}>{planLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: "#F1E9DC" }}>
                <dt className="text-sm font-medium" style={{ color: "#7a6e5f" }}>Generations</dt>
                <dd className="text-sm font-semibold" style={{ color: NAVY }}>{generationsText}</dd>
              </div>
            </dl>
          </section>

          {/* Manage subscription */}
          {subscription && (subscription.status === "active" || subscription.status === "pending") && (
            <section
              className="mt-6 rounded-3xl border bg-[#FAF6EF] p-6 shadow-sm"
              style={{ borderColor: "rgba(14, 148, 132,0.2)" }}
            >
              <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: TEAL }}>
                Manage Subscription
              </h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
                Pro Monthly · Billed ₹349 every 30 days via Razorpay
                {subscription.status === "pending" && (
                  <span className="mt-1 block font-semibold text-amber-600">
                    Your last renewal payment failed — we&apos;re automatically retrying. Your Pro access is unaffected for now.
                  </span>
                )}
              </p>

              {cancelError && <p className="mt-3 text-sm text-red-600">{cancelError}</p>}

              {subscription.cancel_at_cycle_end ? (
                <p className="mt-4 text-sm font-semibold" style={{ color: NAVY }}>
                  Cancels on {subscription.current_period_end ?? "your next billing date"} — no further charges.
                </p>
              ) : (
                <>
                  {subscription.current_period_end && (
                    <p className="mt-1 text-sm" style={{ color: "#7a6e5f" }}>
                      Next billing date: {subscription.current_period_end}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    Cancel Auto-Renewal
                  </button>
                </>
              )}
            </section>
          )}

          {/* Download my data */}
          <section
            className="mt-6 rounded-3xl border bg-[#FAF6EF] p-6 shadow-sm"
            style={{ borderColor: "rgba(14, 148, 132,0.2)" }}
          >
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: TEAL }}>
              My Data
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
              Download a copy of all your Layah data including your account info, usage stats, and all saved lesson plans as a JSON file.
            </p>

            {downloadSuccess && (
              <div
                className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
                style={{ background: "rgba(14, 148, 132,0.1)", color: "#0B6B5F" }}
              >
                <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Your data has been downloaded successfully.
              </div>
            )}

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: TEAL }}
            >
              {downloading ? (
                <>
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Preparing…
                </>
              ) : (
                <>
                  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download My Data
                </>
              )}
            </button>
          </section>

          {/* Cookie preferences */}
          <section
            className="mt-6 rounded-3xl border bg-[#FAF6EF] p-6 shadow-sm"
            style={{ borderColor: "rgba(14, 148, 132,0.2)" }}
          >
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: TEAL }}>
              Cookie Preferences
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
              We only use essential cookies required for authentication and your session. You can reset your cookie choice at any time.
            </p>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("layah_cookie_consent");
                window.location.reload();
              }}
              className="mt-4 inline-flex min-h-9 items-center rounded-xl border px-4 text-sm font-semibold transition hover:bg-stone-50"
              style={{ borderColor: "#D9CCB8", color: "#6B5D4F" }}
            >
              Reset Cookie Choice
            </button>
          </section>

          {/* Danger zone */}
          <section
            className="mt-6 rounded-3xl border bg-[#FAF6EF] p-6 shadow-sm"
            style={{ borderColor: "rgba(239,68,68,0.2)" }}
          >
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-500">
              Danger Zone
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
              Deleting your account is permanent and cannot be undone. All your lesson plans, question papers, and worksheets will be removed.
            </p>
            {deleteError && (
              <p className="mt-3 text-sm text-red-600">{deleteError}</p>
            )}
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-100"
            >
              Delete My Account
            </button>
          </section>
        </div>
      </Container>

      {showDeleteModal && (
        <DeleteConfirmModal
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setShowDeleteModal(false); setDeleteError(null); }}
          deleting={deleting}
        />
      )}

      {showCancelModal && (
        <CancelConfirmModal
          onConfirm={handleCancelSubscription}
          onCancel={() => { setShowCancelModal(false); setCancelError(null); }}
          cancelling={cancelling}
        />
      )}
    </main>
  );
}
