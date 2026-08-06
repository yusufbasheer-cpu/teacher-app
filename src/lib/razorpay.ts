import crypto from "crypto";
import Razorpay from "razorpay";
import { PRICING_REGIONS, type PaidPlanKey } from "@/lib/pricing-regions";

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

/** Amount in paise, always priced off the India region regardless of the buyer's own region. */
export function amountInPaiseFor(planType: RazorpayPlanType, billingPeriod: BillingPeriod): number {
  const priceKey = PLAN_TYPE_TO_PRICE_KEY[planType];
  const pair = PRICING_REGIONS.india.prices[priceKey];
  const rupees = billingPeriod === "yearly" ? pair.annual : pair.monthly;
  return Math.round(rupees * 100);
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
