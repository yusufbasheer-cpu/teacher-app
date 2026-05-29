"use client";

import { PRICING_REGIONS, type PricingRegion, type PricingRegionId } from "@/lib/pricing-regions";

const AED_REGION: PricingRegion = PRICING_REGIONS["gcc"];

/** Geo detection disabled — always returns AED (UAE). Re-enable when payment gateway is live. */
export function usePricingRegion() {
  return {
    region: AED_REGION,
    regionId: "gcc" as PricingRegionId,
    countryCode: "AE",
    countryName: "UAE",
    loading: false,
    geoDetected: false,
    setRegionManually: (_id: PricingRegionId) => {},
  };
}
