import { NextResponse } from "next/server";
import { PRICING_REGIONS } from "@/lib/pricing-regions";
import { getRequestCountryCode, resolveCheckoutRegionId } from "@/lib/razorpay";

export const runtime = "nodejs";

/**
 * Tells the payment modal which region/currency create-order will actually charge for this
 * caller, so the price shown always matches the price billed (both come from the same function).
 */
export async function GET(req: Request) {
  const countryCode = getRequestCountryCode(req);
  const regionId = resolveCheckoutRegionId(countryCode);
  console.info(
    `[razorpay/checkout-region] Caller country is ${countryCode ?? "unknown"}, so checkout will charge in ${PRICING_REGIONS[regionId].currency}.`,
  );
  return NextResponse.json(
    { regionId, currency: PRICING_REGIONS[regionId].currency, countryCode },
    { headers: { "Cache-Control": "no-store" } },
  );
}
