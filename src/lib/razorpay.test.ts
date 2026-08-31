import crypto from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRICING_REGIONS } from "@/lib/pricing-regions";
import {
  amountInPaiseFor,
  verifyPaymentSignature,
  verifySubscriptionSignature,
  verifyWebhookSignature,
} from "./razorpay";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("razorpay", () => {
  it("derives amounts from the India pricing table", () => {
    expect(amountInPaiseFor("pro", "monthly")).toBe(PRICING_REGIONS.india.prices.pro.monthly * 100);
    expect(amountInPaiseFor("pro_plus", "yearly")).toBe(PRICING_REGIONS.india.prices.proPlus.annual * 100);
  });

  it("verifies order and subscription signatures with the configured secret", () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test-secret");

    const orderSignature = crypto.createHmac("sha256", "test-secret").update("order_1|pay_1").digest("hex");
    const subscriptionSignature = crypto
      .createHmac("sha256", "test-secret")
      .update("pay_1|sub_1")
      .digest("hex");

    expect(verifyPaymentSignature("order_1", "pay_1", orderSignature)).toBe(true);
    expect(verifyPaymentSignature("order_1", "pay_1", "deadbeef")).toBe(false);
    expect(verifySubscriptionSignature("sub_1", "pay_1", subscriptionSignature)).toBe(true);
    expect(verifySubscriptionSignature("sub_1", "pay_1", "deadbeef")).toBe(false);
  });

  it("verifies webhook signatures with the webhook secret", () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "webhook-secret");

    const rawBody = JSON.stringify({ event: "payment.captured", payload: { id: "evt_1" } });
    const signature = crypto.createHmac("sha256", "webhook-secret").update(rawBody).digest("hex");

    expect(verifyWebhookSignature(rawBody, signature)).toBe(true);
    expect(verifyWebhookSignature(rawBody, "deadbeef")).toBe(false);
    expect(verifyWebhookSignature(rawBody, "")).toBe(false);
  });
});
