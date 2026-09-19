/** Keep post-sign-in navigation on this application, including query parameters. */
export function getSafeAuthNext(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) {
    return "/overview";
  }
  try {
    const url = new URL(value, "https://layah.local");
    if (url.origin !== "https://layah.local" || /^\/(?:auth|login|signup|onboarding)(?:\/|$)/.test(url.pathname)) {
      return "/overview";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/overview";
  }
}

export function getOnboardingDestination(next: string): string {
  return next === "/overview" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(next)}`;
}
