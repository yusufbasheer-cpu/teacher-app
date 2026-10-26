"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onUserChange } from "@/lib/client-cache";
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

  // Usage drives credit/plan UI, so it is intentionally NOT cached across
  // mounts — the server answer is always fetched fresh. What we do here is
  // keep the last answer on screen while a refresh runs (no flash back to
  // "Loading usage…"), and drop any response that was overtaken by a newer
  // request, an unmount, or an account change.
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const id = ++latest.current;
    setState((s) => (s.usage ? s : { ...s, loading: true }));
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
      if (id !== latest.current) return;
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
      // Network blip: keep whatever we were already showing.
      if (id === latest.current) setState((s) => ({ ...s, loading: false }));
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    const stopWatching = onUserChange(() => {
      latest.current++;
      setState({ usage: null, loading: enabled, headline: "", subline: "" });
      void refresh();
    });
    return () => {
      latest.current++;
      stopWatching();
    };
  }, [refresh, enabled]);

  return { ...state, refresh, applyUsage };
}
