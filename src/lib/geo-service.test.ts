import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveGeoLocation } from "./geo-service";

describe("resolveGeoLocation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the Vercel country header without calling external services", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveGeoLocation(new Headers({ "x-vercel-ip-country": "IN" }));
    expect(result).toEqual({ country_code: "IN", country_name: "IN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to ipapi.co using the forwarded IP", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ country_code: "GB", country_name: "United Kingdom" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveGeoLocation(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }));

    expect(result).toEqual({ country_code: "GB", country_name: "United Kingdom" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ipapi.co/203.0.113.5/json/",
      expect.objectContaining({
        headers: { "User-Agent": "LayahPricing/1.0" },
        cache: "no-store",
      }),
    );
  });

  it("falls back to api.country.is when ipapi.co fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ country: "PK", ip: "1.2.3.4" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveGeoLocation(new Headers({ "x-real-ip": "198.51.100.2" }));

    expect(result).toEqual({ country_code: "PK", country_name: "PK" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("defaults to UAE when every lookup fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValueOnce(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveGeoLocation(new Headers());
    expect(result).toEqual({ country_code: "AE", country_name: "UAE" });
  });
});

