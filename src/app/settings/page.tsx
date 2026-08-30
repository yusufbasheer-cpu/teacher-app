"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import {
  Badge,
  Meter,
  Notice,
  PageTitle,
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
      /* silent - browser already shows network errors */
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
      <div className="mx-auto w-full max-w-[720px] px-4 py-6 sm:px-6 sm:py-8" aria-hidden>
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
    <div className="mx-auto w-full max-w-[720px] px-4 py-6 sm:px-6 sm:py-8">
      <PageTitle title="Settings" description="Your account, plan and data." />

      <Panel className="mt-5 overflow-hidden">
        <PanelHeader title="Account" />
        <dl className="divide-y divide-line-subtle">
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-[13px] text-muted">Full name</dt>
            <dd className="truncate text-[13px] text-ink">{profile?.fullName ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-[13px] text-muted">Mobile number</dt>
            <dd className="truncate text-[13px] text-ink">{profile?.phone ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-[13px] text-muted">Email</dt>
            <dd className="truncate text-[13px] text-ink">{profile?.email ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-[13px] text-muted">Plan</dt>
            <dd className="flex items-center gap-2">
              <Badge tone={onFree ? "neutral" : "brand"}>{planLabel}</Badge>
              {onFree ? (
                <Link
                  href="/pricing"
                  className="text-[12px] font-medium text-brand-text underline-offset-2 hover:underline"
                >
                  Compare plans
                </Link>
              ) : null}
            </dd>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[13px] text-muted">Generations this month</dt>
              <dd className="font-mono text-[12px] tabular-nums text-ink">
                {usage
                  ? usage.unlimited || usage.generationsLimit == null
                    ? "Unlimited"
                    : `${usage.generationsUsed} / ${usage.generationsLimit}`
                  : "-"}
              </dd>
            </div>
            {usage && !usage.unlimited && usage.generationsLimit != null ? (
              <Meter used={usage.generationsUsed} limit={usage.generationsLimit} className="mt-2" />
            ) : null}
          </div>
        </dl>
      </Panel>

      {hasLiveSub ? (
        <Panel className="mt-4 overflow-hidden">
          <PanelHeader title="Subscription" description="Pro Monthly - Rs.349 every 30 days" />
          <div className="p-4">
            {subscription.status === "pending" ? (
              <Notice tone="generated" className="mb-3">
                Your last renewal payment failed and we&apos;re retrying automatically. Pro access
                is unaffected for now.
              </Notice>
            ) : null}
            {cancelError ? (
              <Notice tone="danger" className="mb-3">
                {cancelError}
              </Notice>
            ) : null}

            {subscription.cancel_at_cycle_end ? (
              <p className="text-[13px] text-muted">
                Auto-renewal is off. Pro stays active until{" "}
                <span className="font-medium text-ink">
                  {subscription.current_period_end ?? "your next billing date"}
                </span>
                , then no further charges.
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted">
                  {subscription.current_period_end
                    ? `Renews ${subscription.current_period_end}`
                    : "Renews automatically"}
                </p>
                <Button variant="outline" size="sm" onClick={() => setShowCancelModal(true)}>
                  Turn off auto-renewal
                </Button>
              </div>
            )}
          </div>
        </Panel>
      ) : null}

      <Panel className="mt-4 overflow-hidden">
        <PanelHeader title="Your data" />
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-sm text-[13px] text-muted">
              Download everything Layah holds for you - account details, usage and every saved
              lesson - as a JSON file.
            </p>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Spinner className="size-3.5" /> : <Download />}
              {downloading ? "Preparing..." : "Download"}
            </Button>
          </div>
          {downloadSuccess ? (
            <Notice tone="brand" className="mt-3">
              Downloaded. Check your browser&apos;s downloads folder.
            </Notice>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-4">
            <p className="max-w-sm text-[13px] text-muted">
              Layah only uses cookies required for sign-in and your session. You can reset your
              choice at any time.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem("layah_cookie_consent");
                window.location.reload();
              }}
            >
              Reset cookie choice
            </Button>
          </div>
        </div>
      </Panel>

      <Panel className="mt-4 overflow-hidden">
        <PanelHeader title="Delete account" />
        <div className="p-4">
          {deleteError ? (
            <Notice tone="danger" className="mb-3">
              {deleteError}
            </Notice>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-sm text-[13px] text-muted">
              Permanently removes your account and every lesson, question paper and worksheet you
              have generated. This can&apos;t be undone.
            </p>
            <Button variant="danger-quiet" size="sm" onClick={() => setShowDeleteModal(true)}>
              Delete account
            </Button>
          </div>
        </div>
      </Panel>

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
