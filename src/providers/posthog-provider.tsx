"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { shouldSendTelemetry } from "@/lib/runtime-env";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (pathname && ph) {
      const url =
        window.origin +
        pathname +
        (searchParams.toString() ? `?${searchParams.toString()}` : "");
      ph.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams, ph]);

  return null;
}

// Production only. NEXT_PUBLIC_POSTHOG_KEY is bound to Preview as well as
// Production, so staging used to report into the same project: every click
// while testing a deploy counted as a teacher's pageview. Nothing distinguished
// them afterwards, because the events were identical in shape.
if (typeof window !== "undefined" && shouldSendTelemetry()) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    // Must stay the relative /ingest path (see the rewrite in next.config.ts),
    // not NEXT_PUBLIC_POSTHOG_HOST - pointing at us.i.posthog.com directly is
    // exactly what ad blockers drop.
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
  });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
