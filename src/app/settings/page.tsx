"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { getAuthHeaders } from "@/lib/auth-headers";
import { supabase } from "@/lib/supabase";
import type { UserUsageSnapshot } from "@/lib/user-usage";

const NAVY = "#0A1628";
const TEAL = "#00C6A7";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro Plus",
  school_starter: "School Starter",
  school_pro: "School Pro",
  school_enterprise: "School Enterprise",
};

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
        className="absolute inset-0 bg-[#0A1628]/70 backdrop-blur-sm"
        aria-label="Cancel"
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-sm rounded-3xl border bg-white p-8 shadow-2xl"
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
        <p className="mt-3 text-center text-sm leading-relaxed" style={{ color: "#4A5568" }}>
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
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-60"
            style={{ borderColor: "#CBD5E0", color: "#4A5568" }}
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
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/auth");
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
      } finally {
        setLoadingPage(false);
      }
    };

    void init();
  }, [router]);

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
      <main className="flex min-h-screen items-center justify-center" style={{ background: "#F7F9FC" }}>
        <p className="text-sm font-medium" style={{ color: "#64748b" }}>Loading…</p>
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
    <main className="min-h-screen pb-16 pt-10" style={{ background: "#F7F9FC" }}>
      <Container>
        <div className="mx-auto max-w-xl">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            Account Settings
          </h1>
          <p className="mt-2 text-sm" style={{ color: "#4A5568" }}>
            Manage your Layah account and data.
          </p>

          {/* Account details */}
          <section
            className="mt-8 rounded-3xl border bg-white p-6 shadow-sm"
            style={{ borderColor: "rgba(0,198,167,0.2)" }}
          >
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: TEAL }}>
              Account Details
            </h2>
            <dl className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: "#F7F9FC" }}>
                <dt className="text-sm font-medium" style={{ color: "#64748b" }}>Email</dt>
                <dd className="text-sm font-semibold" style={{ color: NAVY }}>{email ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: "#F7F9FC" }}>
                <dt className="text-sm font-medium" style={{ color: "#64748b" }}>Plan</dt>
                <dd className="text-sm font-semibold" style={{ color: NAVY }}>{planLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: "#F7F9FC" }}>
                <dt className="text-sm font-medium" style={{ color: "#64748b" }}>Generations</dt>
                <dd className="text-sm font-semibold" style={{ color: NAVY }}>{generationsText}</dd>
              </div>
            </dl>
          </section>

          {/* Cookie preferences */}
          <section
            className="mt-6 rounded-3xl border bg-white p-6 shadow-sm"
            style={{ borderColor: "rgba(0,198,167,0.2)" }}
          >
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: TEAL }}>
              Cookie Preferences
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "#4A5568" }}>
              We only use essential cookies required for authentication and your session. You can reset your cookie choice at any time.
            </p>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("layah_cookie_consent");
                window.location.reload();
              }}
              className="mt-4 inline-flex min-h-9 items-center rounded-xl border px-4 text-sm font-semibold transition hover:bg-slate-50"
              style={{ borderColor: "#CBD5E0", color: "#4A5568" }}
            >
              Reset Cookie Choice
            </button>
          </section>

          {/* Danger zone */}
          <section
            className="mt-6 rounded-3xl border bg-white p-6 shadow-sm"
            style={{ borderColor: "rgba(239,68,68,0.2)" }}
          >
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-500">
              Danger Zone
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "#4A5568" }}>
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
    </main>
  );
}
