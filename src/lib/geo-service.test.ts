import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveGeoLocation } from "./geo-service";

type GeoFixtureCase = {
  name: string;
  headers: Record<string, string>;
  fetches?: Array<{
    url: string;
    status: number;
    json?: Record<string, unknown>;
    text?: string;
  }>;
  expected: { country_code: string; country_name: string };
};

const fixturePath = resolve(process.cwd(), "contract-fixtures", "geo", "geo-contract.json");
const cases = JSON.parse(readFileSync(fixturePath, "utf-8")) as { cases: GeoFixtureCase[] };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("geo-service", () => {
  it.each(cases.cases)("matches the shared geo contract for $name", async (scenario) => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      const expected = scenario.fetches?.shift();
      expect(expected, `unexpected fetch for ${scenario.name}`).toBeDefined();
      expect(url).toContain(expected!.url);
      return new Response(
        expected!.json ? JSON.stringify(expected!.json) : expected!.text ?? "",
        {
          status: expected!.status,
          headers: expected!.json ? { "content-type": "application/json" } : {},
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveGeoLocation(new Headers(scenario.headers))).resolves.toEqual(
      scenario.expected,
    );

    if (scenario.name === "vercel_header") {
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });
});
