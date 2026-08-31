const DEFAULT_COUNTRY_CODE = "AE";
const DEFAULT_COUNTRY_NAME = "UAE";

export type GeoLocation = {
  country_code: string;
  country_name: string;
};

function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const realIp = headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() ?? realIp?.trim() ?? "";
}

async function tryIpApiCo(ip: string): Promise<GeoLocation | null> {
  const url =
    ip && ip !== "127.0.0.1" && ip !== "::1"
      ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
      : "https://ipapi.co/json/";

  console.log("[geo] Trying ipapi.co:", url);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "LayahPricing/1.0" },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("[geo] ipapi.co responded with status:", res.status);
      return null;
    }

    const data = (await res.json()) as {
      country_code?: string;
      country_name?: string;
      error?: boolean;
      reason?: string;
    };

    if (data.error) {
      console.warn("[geo] ipapi.co returned error:", data.reason);
      return null;
    }

    if (!data.country_code) {
      console.warn("[geo] ipapi.co returned no country_code:", data);
      return null;
    }

    console.log("[geo] ipapi.co success:", { country_code: data.country_code, country_name: data.country_name });
    return { country_code: data.country_code, country_name: data.country_name ?? data.country_code };
  } catch (err) {
    console.warn("[geo] ipapi.co fetch failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function tryCountryIs(): Promise<GeoLocation | null> {
  console.log("[geo] Trying api.country.is");

  try {
    const res = await fetch("https://api.country.is/", {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("[geo] api.country.is responded with status:", res.status);
      return null;
    }

    const data = (await res.json()) as { country?: string; ip?: string };

    if (!data.country) {
      console.warn("[geo] api.country.is returned no country:", data);
      return null;
    }

    console.log("[geo] api.country.is success:", data.country);
    return { country_code: data.country, country_name: data.country };
  } catch (err) {
    console.warn("[geo] api.country.is fetch failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function resolveGeoLocation(headers: Headers): Promise<GeoLocation> {
  console.log("[geo] Fetching location...");

  const vercelCountry = headers.get("x-vercel-ip-country");
  if (vercelCountry) {
    console.log("[geo] Location result via Vercel header:", vercelCountry);
    return { country_code: vercelCountry, country_name: vercelCountry };
  }
  console.log("[geo] No Vercel geo header - falling back to external APIs");

  const ip = getClientIp(headers);
  console.log("[geo] Detected IP:", ip || "(none)");

  const ipApiResult = await tryIpApiCo(ip);
  if (ipApiResult) {
    console.log("[geo] Location result:", ipApiResult);
    return ipApiResult;
  }

  const countryIsResult = await tryCountryIs();
  if (countryIsResult) {
    console.log("[geo] Location result:", countryIsResult);
    return countryIsResult;
  }

  console.log("[geo] All detection methods failed - defaulting to UAE");
  return {
    country_code: DEFAULT_COUNTRY_CODE,
    country_name: DEFAULT_COUNTRY_NAME,
  };
}
