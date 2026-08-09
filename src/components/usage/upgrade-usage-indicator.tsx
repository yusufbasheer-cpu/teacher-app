"use client";

import { useState } from "react";
import { GenerationUsageIndicator } from "@/components/usage/generation-usage-indicator";
import { PaymentModal, type UpgradePlanKey } from "@/components/payment/payment-modal";
import type { UserUsageSnapshot } from "@/lib/user-usage";
import { PLANS } from "@/lib/plans";

const TEAL = "#00C6A7";
const NAVY = "#0A1628";

type Props = {
  usage: UserUsageSnapshot | null;
  loading?: boolean;
};

export function getUpgradePlan(usage: UserUsageSnapshot | null): UpgradePlanKey | null {
  if (!usage) return null;
  if (usage.unlimited) return null;
  if (usage.planType === "free") return "pro";
  if (usage.planType === "pro") return "proPlus";
  return null;
}

export const UPGRADE_COPY: Record<UpgradePlanKey, { label: string; sub: string }> = {
  pro: { label: "Upgrade to Pro", sub: `${PLANS.pro.generationsLimit} generations/month · All themes · Q-Paper generator` },
  proPlus: { label: "Upgrade to Pro Plus", sub: `${PLANS.pro_plus.generationsLimit} generations/month · Advanced analytics · Early access` },
};

export function UpgradeUsageIndicator({ usage, loading }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const upgradePlan = getUpgradePlan(usage);

  return (
    <>
      <GenerationUsageIndicator usage={usage} loading={loading} />

      {upgradePlan && !loading && (
        <div
          className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
          style={{ background: "rgba(0,198,167,0.04)", borderColor: "rgba(0,198,167,0.2)" }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: NAVY }}>
              {UPGRADE_COPY[upgradePlan].label}
            </p>
            <p className="mt-0.5 truncate text-xs" style={{ color: "#64748b" }}>
              {UPGRADE_COPY[upgradePlan].sub}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="shrink-0 inline-flex min-h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: TEAL }}
          >
            Upgrade Now
          </button>
        </div>
      )}

      {upgradePlan && (
        <PaymentModal
          open={modalOpen}
          planKey={upgradePlan}
          onClose={() => setModalOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </>
  );
}
