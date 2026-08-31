"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/frontend-api-client";
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
      const { response, parsed } = await apiJson<{
        usage?: UserUsageSnapshot;
        upgradePitch?: { headline: string; subline: string };
        error?: string;
      }>("/api/user-usage", {
        auth: "bearer",
        cache: "no-store",
      });
      const usage = parsed.ok ? parsed.data.usage : undefined;
      if (!response.ok || !parsed.ok || !usage) {
        console.warn("[user-usage] failed to load usage", {
          status: response.status,
          error: parsed.ok ? parsed.data.error : parsed.message,
        });
        setState((s) => ({ ...s, usage: null, loading: false }));
        return;
      }
      const data = parsed.data;
      logUsageSnapshot("page load", usage);
      const pitch = data.upgradePitch ?? getUpgradePitch(usage.planType);
      setState({
        usage,
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
