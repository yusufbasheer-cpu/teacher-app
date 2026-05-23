"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCountryDisplayName,
  getRegionForCountryCode,
  isPricingRegionId,
  PRICING_REGIONS,
  PRICING_STORAGE_KEY,
  type PricingRegion,
  type PricingRegionId,
} from "@/lib/pricing-regions";

type GeoResponse = {
  country_code?: string;
  country_name?: string;
};

export function usePricingRegion() {
  const [regionId, setRegionId] = useState<PricingRegionId>("usd");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [countryName, setCountryName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [geoDetected, setGeoDetected] = useState(false);

  const region: PricingRegion = PRICING_REGIONS[regionId];

  const applyRegion = useCallback((id: PricingRegionId, persist: boolean) => {
    setRegionId(id);
    if (persist && typeof window !== "undefined") {
      try {
        localStorage.setItem(PRICING_STORAGE_KEY, id);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const stored =
          typeof window !== "undefined"
            ? localStorage.getItem(PRICING_STORAGE_KEY)
            : null;

        if (stored && isPricingRegionId(stored)) {
          if (!cancelled) {
            applyRegion(stored, false);
            setCountryName(PRICING_REGIONS[stored].selectorLabel);
            setLoading(false);
          }
          return;
        }

        const res = await fetch("/api/geo", { cache: "no-store" });
        const data = (await res.json()) as GeoResponse;
        const cc = data.country_code ?? "US";
        const detected = getRegionForCountryCode(cc);

        if (!cancelled) {
          setCountryCode(cc);
          setCountryName(data.country_name ?? getCountryDisplayName(cc));
          applyRegion(detected, true);
          setGeoDetected(true);
        }
      } catch {
        if (!cancelled) {
          applyRegion("usd", true);
          setCountryCode("US");
          setCountryName("United States");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [applyRegion]);

  const setRegionManually = useCallback(
    (id: PricingRegionId) => {
      applyRegion(id, true);
      setGeoDetected(false);
      const r = PRICING_REGIONS[id];
      setCountryCode(null);
      setCountryName(r.selectorLabel);
    },
    [applyRegion],
  );

  return {
    region,
    regionId,
    countryCode,
    countryName,
    loading,
    geoDetected,
    setRegionManually,
  };
}
