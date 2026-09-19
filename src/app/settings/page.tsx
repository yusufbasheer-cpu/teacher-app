"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ShieldCheck, CreditCard, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import {
  Badge,
  Meter,
  Notice,
  Panel,
  PanelHeader,
  Skeleton,
  Spinner,
} from "@/components/ui/panel";
import { getAuthHeaders } from "@/lib/auth-headers";
import { getTeacherProfile } from "@/lib/user-profile";
import { supabase } from "@/lib/supabase";
import type { UserUsageSnapshot } from "@/lib/user-usage";
import { useErrorToast } from "@/hooks/use-error-toast";

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

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{
    fullName: string;
    phone: string;
    email: string;
  } | null>(null);
  const [usage, setUsage] = useState<UserUsageSnapshot | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useErrorToast();
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useErrorToast();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useErrorToast();
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

      const meta = getTeacherProfile(session.user);
      setProfile({
        fullName: meta.full_name?.trim() || "-",
        phone: meta.phone?.trim() || "-",
        email: session.user.email || "-",
      });

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
    setDownloadError(null);
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
      setDownloadError("We could not prepare your data export. Please try again.");
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
      <div className="workspace-page !max-w-5xl" aria-hidden>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-5 h-[132px] rounded-lg" />
        <Skeleton className="mt-4 h-[96px] rounded-lg" />
        <Skeleton className="mt-4 h-[96px] rounded-lg" />
      </div>
    );
  }

  const planLabel = usage ? (PLAN_LABELS[usage.planType] ?? usage.planType) : "-";
  const onFree = usage?.planType === "free";
  const hasLiveSub =
    subscription && (subscription.status === "active" || subscription.status === "pending");

  return (
    <div className="workspace-page !max-w-5xl">
      <header className="page-header">
        <div>
          <p className="page-kicker">Your workspace</p>
          <h1 className="page-title">Account settings</h1>
          <p className="page-description">Manage your profile details, subscription, and personal data.</p>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
        <Panel className="overflow-hidden">
          <div className="border-b border-line bg-sunken p-6">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-line bg-surface text-brand-text"><UserRound className="size-6" aria-hidden /></div>
            <h2 className="section-heading break-words">{profile?.fullName ?? "Your account"}</h2>
            <p className="mt-2 break-all text-sm text-muted">{profile?.email}</p>
            <div className="mt-4"><Badge tone={onFree ? "neutral" : "brand"}>{planLabel}</Badge></div>
          </div>
          <dl className="space-y-5 p-6">
            <div><dt className="text-sm text-muted">Mobile number</dt><dd className="mt-1 text-sm font-medium text-ink">{profile?.phone ?? "-"}</dd></div>
            <div><dt className="text-sm text-muted">Email</dt><dd className="mt-1 break-all text-sm font-medium text-ink">{profile?.email ?? "-"}</dd></div>
          </dl>
        </Panel>

        <div className="space-y-6">
          <Panel className="overflow-hidden">
            <PanelHeader title="Plan and usage" description="Your current access and monthly allowance." />
            <div className="space-y-5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3"><CreditCard className="size-5 text-brand-text" aria-hidden /><p className="font-medium text-ink">{planLabel}</p></div>
                <Button render={<Link href="/pricing" />} variant="outline" size="sm">Compare plans</Button>
              </div>
              <div className="rounded-xl border border-line bg-sunken p-4">
                <div className="flex flex-wrap justify-between gap-3 text-sm"><span className="text-muted">Generations this month</span><span className="font-medium tabular-nums text-ink">{usage ? usage.unlimited || usage.generationsLimit == null ? `${usage.generationsUsed} used ? Unlimited` : `${usage.generationsUsed} / ${usage.generationsLimit}` : "Usage unavailable"}</span></div>
                {usage && !usage.unlimited && usage.generationsLimit != null ? <Meter used={usage.generationsUsed} limit={usage.generationsLimit} className="mt-3" /> : null}
              </div>
              {hasLiveSub && subscription ? (
                <div className="border-t border-line pt-5">
                  {subscription.status === "pending" ? <Notice tone="generated" className="mb-4">Your last renewal payment failed. We are retrying automatically; your access is unaffected for now.</Notice> : null}
                  {cancelError ? <Notice tone="danger" className="mb-4">{cancelError}</Notice> : null}
                  {subscription.cancel_at_cycle_end ? (
                    <p className="text-sm leading-6 text-muted">Auto-renewal is off. Your plan stays active until {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString(undefined, { dateStyle: "medium" }) : "the end of this billing period"}.</p>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-muted">{subscription.current_period_end ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString(undefined, { dateStyle: "medium" })}` : "Renews automatically"}</p>
                      <Button variant="ghost" size="sm" onClick={() => setShowCancelModal(true)}>Turn off auto-renewal</Button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Privacy and data" description="Access your information and manage your preferences." />
            <div className="divide-y divide-line px-6">
              <div className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-sm"><h3 className="text-sm font-medium text-ink">Export your data</h3><p className="mt-1 text-sm leading-6 text-muted">Download your account details, usage, and saved lessons as a JSON file.</p></div>
                  <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>{downloading ? <Spinner className="size-4" /> : <Download />}{downloading ? "Preparing..." : "Export data"}</Button>
                </div>
                {downloadError ? <Notice tone="danger" className="mt-4">{downloadError}</Notice> : null}
                {downloadSuccess ? <Notice tone="brand" className="mt-4">Your export is ready. Check your browser downloads.</Notice> : null}
              </div>
              <div className="flex flex-wrap items-start justify-between gap-4 py-5">
                <div className="max-w-sm"><h3 className="text-sm font-medium text-ink">Cookie preferences</h3><p className="mt-1 text-sm leading-6 text-muted">Reopen the cookie notice to review your choice.</p></div>
                <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("layah_cookie_consent"); window.location.reload(); }}>Review preferences</Button>
              </div>
              <div className="flex items-start gap-3 py-5 text-sm leading-6 text-muted"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-text" aria-hidden /><p>Read how we handle your information in our <Link href="/privacy" className="font-medium text-brand-text underline underline-offset-4">privacy policy</Link>.</p></div>
            </div>
          </Panel>

          <Panel className="overflow-hidden !border-danger/25">
            <div className="p-6">
              <h2 className="section-heading">Delete account</h2>
              {deleteError ? <Notice tone="danger" className="mt-4">{deleteError}</Notice> : null}
              <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                <p className="max-w-sm text-sm leading-6 text-muted">Permanently delete your account and all generated resources. This action cannot be undone.</p>
                <Button variant="danger-quiet" size="sm" onClick={() => setShowDeleteModal(true)}>Delete account</Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteModal}
        busy={deleting}
        title="Delete your account?"
        confirmLabel="Delete account"
        description="This permanently removes your account and every lesson, question paper and worksheet you have generated. It can't be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeleteError(null);
        }}
      />

      <ConfirmDialog
        open={showCancelModal}
        busy={cancelling}
        tone="default"
        title="Turn off auto-renewal?"
        confirmLabel="Turn off auto-renewal"
        cancelLabel="Keep it on"
        description="You keep Pro until the end of the current billing period. No further payments will be taken after that."
        onConfirm={handleCancelSubscription}
        onCancel={() => {
          setShowCancelModal(false);
          setCancelError(null);
        }}
      />
    </div>
  );
}
