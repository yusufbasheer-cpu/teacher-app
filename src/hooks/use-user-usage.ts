"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthHeaders } from "@/lib/auth-headers";
import { getUpgradePitch, logUsageSnapshot, type UserUsageSnapshot } from "@/lib/user-usage";

type UsageState = {
  usage: UserUsageSnapshot | null;
  loading: boolean;
  headline: string;
  subline: string;
};

export function useUserUsage(enabled: boolean) {
  const [state, setState] = useState<UsageState>({
    usage: null,
    loading: enabled,
    headline: "",
    subline: "",
  });

  const applyUsage = useCallback((usage: UserUsageSnapshot) => {
    const pitch = getUpgradePitch(usage.planType);
    setState({
      usage,
      loading: false,
      headline: pitch.headline,
      subline: pitch.subline,
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch("/api/user-usage", {
        headers: await getAuthHeaders(),
        cache: "no-store",
      });
      const data = (await res.json()) as {
        usage?: UserUsageSnapshot;
        upgradePitch?: { headline: string; subline: string };
        error?: string;
      };
      if (!res.ok || !data.usage) {
        console.warn("[user-usage] failed to load usage", {
          status: res.status,
          error: data.error,
        });
        setState((s) => ({ ...s, usage: null, loading: false }));
        return;
      }
      logUsageSnapshot("page load", data.usage);
      const pitch = data.upgradePitch ?? getUpgradePitch(data.usage.planType);
      setState({
        usage: data.usage,
        loading: false,
        headline: pitch.headline,
        subline: pitch.subline,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh, applyUsage };
}
