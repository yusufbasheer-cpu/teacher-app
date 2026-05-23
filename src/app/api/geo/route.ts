import { NextRequest, NextResponse } from "next/server";

type IpApiResponse = {
  country_code?: string;
  country_name?: string;
  error?: boolean;
  reason?: string;
};

/** Resolve visitor country via ipapi.co (defaults to US on failure). */
export async function GET(request: NextRequest) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0]?.trim() || realIp?.trim() || "";

    const url =
      ip && ip !== "127.0.0.1" && ip !== "::1"
        ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
        : "https://ipapi.co/json/";

    const res = await fetch(url, {
      headers: { "User-Agent": "LayahPricing/1.0" },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`ipapi status ${res.status}`);
    }

    const data = (await res.json()) as IpApiResponse;
    if (data.error) {
      throw new Error(data.reason ?? "ipapi error");
    }

    return NextResponse.json({
      country_code: data.country_code ?? "US",
      country_name: data.country_name ?? "United States",
    });
  } catch {
    return NextResponse.json({
      country_code: "US",
      country_name: "United States",
    });
  }
}
