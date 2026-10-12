import crypto from "crypto";
import Razorpay from "razorpay";
import {
  getRegionForCountryCode,
  PRICING_REGIONS,
  type PaidPlanKey,
  type PricingRegionId,
} from "@/lib/pricing-regions";

export type RazorpayPlanType = "pro" | "pro_plus";
export type BillingPeriod = "monthly" | "yearly";

const PLAN_TYPE_TO_PRICE_KEY: Record<RazorpayPlanType, PaidPlanKey> = {
  pro: "pro",
  pro_plus: "proPlus",
};

export function isRazorpayPlanType(value: string): value is RazorpayPlanType {
  return value === "pro" || value === "pro_plus";
}

export function isBillingPeriod(value: string): value is BillingPeriod {
  return value === "monthly" || value === "yearly";
}

let client: Razorpay | null | undefined;

/** Lazy singleton, mirrors getSupabaseServiceRole()'s null-if-unconfigured shape. */
export function getRazorpayClient(): Razorpay | null {
  if (client !== undefined) return client;
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    client = null;
    return client;
  }
  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

/**
 * Amount in the currency's minor unit (paise for INR, cents for USD, ...), priced off the given
 * region (India unless told otherwise). Every currency in PRICING_REGIONS uses 100 minor units.
 */
export function amountInPaiseFor(
  planType: RazorpayPlanType,
  billingPeriod: BillingPeriod,
  regionId: PricingRegionId = "india",
): number {
  const priceKey = PLAN_TYPE_TO_PRICE_KEY[planType];
  const pair = PRICING_REGIONS[regionId].prices[priceKey];
  const price = billingPeriod === "yearly" ? pair.annual : pair.monthly;
  return Math.round(price * 100);
}

/**
 * Off by default: non-INR orders only work once Razorpay has enabled those currencies on the
 * account, so this stays "0" until that's confirmed (see RAZORPAY_MULTI_CURRENCY in Vercel).
 */
export function isMultiCurrencyEnabled(): boolean {
  return process.env.RAZORPAY_MULTI_CURRENCY?.trim() === "1";
}

/** Country of the caller as set by Vercel's edge (not spoofable from the browser). */
export function getRequestCountryCode(req: Request): string | null {
  return req.headers.get("x-vercel-ip-country")?.toUpperCase() || null;
}

/**
 * The region we charge in. The server decides this from the caller's country -- never from a
 * client-supplied value -- so a visitor can't pick a cheaper region's price. Anything unknown,
 * or multi-currency being off, means India/INR, the one currency we know always works.
 */
export function resolveCheckoutRegionId(countryCode: string | null | undefined): PricingRegionId {
  if (!isMultiCurrencyEnabled() || !countryCode) return "india";
  return getRegionForCountryCode(countryCode);
}

/** Turns a Razorpay SDK error (a plain object, not an Error) into one readable sentence for logs. */
export function describeRazorpayError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const e = err as { statusCode?: number; error?: { code?: string; description?: string; field?: string } };
    const detail = e.error;
    if (detail?.description) {
      const field = detail.field ? ` (field: ${detail.field})` : "";
      return `Razorpay said "${detail.description}"${field} [code ${detail.code ?? "unknown"}, HTTP ${e.statusCode ?? "?"}]`;
    }
  }
  return "Razorpay returned an error with no details";
}

function hmacMatches(payload: string, secret: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) return false;
  return hmacMatches(`${orderId}|${paymentId}`, secret, signature);
}

/** Verification formula for a subscription's first checkout payment (distinct from orders). */
export function verifySubscriptionSignature(
  subscriptionId: string,
  paymentId: string,
  signature: string,
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) return false;
  return hmacMatches(`${paymentId}|${subscriptionId}`, secret, signature);
}

/** Verifies an inbound webhook POST -- a different secret (dashboard-configured) than the API key secret. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  return Razorpay.validateWebhookSignature(rawBody, signature, secret);
}
