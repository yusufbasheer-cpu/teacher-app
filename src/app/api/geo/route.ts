import { NextRequest, NextResponse } from "next/server";

const DEFAULT_COUNTRY_CODE = "AE";
const DEFAULT_COUNTRY_NAME = "UAE";

/** Try ipapi.co — returns { country_code, country_name } or null. */
async function tryIpApiCo(ip: string): Promise<{ country_code: string; country_name: string } | null> {
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

    const data = (await res.json()) as { country_code?: string; country_name?: string; error?: boolean; reason?: string };

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

/** Try api.country.is — returns { country_code, country_name } or null. */
async function tryCountryIs(): Promise<{ country_code: string; country_name: string } | null> {
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

export async function GET(request: NextRequest) {
  console.log("[geo] Fetching location...");

  // Strategy 1: Vercel injects x-vercel-ip-country automatically — no external call needed
  const vercelCountry = request.headers.get("x-vercel-ip-country");
  if (vercelCountry) {
    console.log("[geo] Location result via Vercel header:", vercelCountry);
    return NextResponse.json({ country_code: vercelCountry, country_name: vercelCountry });
  }
  console.log("[geo] No Vercel geo header — falling back to external APIs");

  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() ?? realIp?.trim() ?? "";
  console.log("[geo] Detected IP:", ip || "(none)");

  // Strategy 2: ipapi.co
  const ipApiResult = await tryIpApiCo(ip);
  if (ipApiResult) {
    console.log("[geo] Location result:", ipApiResult);
    return NextResponse.json(ipApiResult);
  }

  // Strategy 3: api.country.is
  const countryIsResult = await tryCountryIs();
  if (countryIsResult) {
    console.log("[geo] Location result:", countryIsResult);
    return NextResponse.json(countryIsResult);
  }

  // Final fallback: UAE (AED) — majority of current user base
  console.log("[geo] All detection methods failed — defaulting to UAE");
  return NextResponse.json({
    country_code: DEFAULT_COUNTRY_CODE,
    country_name: DEFAULT_COUNTRY_NAME,
  });
}
