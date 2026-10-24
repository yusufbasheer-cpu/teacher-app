"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CONSENT_EVENT, CONSENT_STORAGE_KEY, isTrackablePath } from "@/lib/analytics-consent";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * GA4, loaded only when a measurement ID is configured AND the visitor has
 * accepted cookies. Automatic page views are off; we send one per pathname
 * change so client-side navigations are counted exactly once (the ref dedupes
 * re-renders). Query strings are never sent — they can carry auth codes.
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const [consented, setConsented] = useState(false);
  const [ready, setReady] = useState(false);
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        setConsented(localStorage.getItem(CONSENT_STORAGE_KEY) === "accepted");
      } catch {
        setConsented(false);
      }
    };
    read();
    window.addEventListener(CONSENT_EVENT, read);
    return () => window.removeEventListener(CONSENT_EVENT, read);
  }, []);

  useEffect(() => {
    if (!ready || !pathname || !isTrackablePath(pathname) || lastSent.current === pathname) return;
    lastSent.current = pathname;
    window.gtag?.("event", "page_view", {
      page_path: pathname,
      page_location: window.location.origin + pathname,
    });
  }, [ready, pathname]);

  if (!GA_ID || !consented) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`}
      </Script>
    </>
  );
}
