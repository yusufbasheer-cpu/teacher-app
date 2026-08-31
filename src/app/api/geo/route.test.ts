import { describe, expect, it, vi } from "vitest";

const resolveGeoLocation = vi.hoisted(() => vi.fn());

vi.mock("@/lib/geo-service", () => ({
  resolveGeoLocation,
}));

describe("geo route", () => {
  it("returns the service result as JSON", async () => {
    resolveGeoLocation.mockResolvedValue({ country_code: "IN", country_name: "India" });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/geo", {
        headers: { "x-vercel-ip-country": "IN" },
      }) as never,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ country_code: "IN", country_name: "India" });
    expect(resolveGeoLocation).toHaveBeenCalledTimes(1);
  });
});

