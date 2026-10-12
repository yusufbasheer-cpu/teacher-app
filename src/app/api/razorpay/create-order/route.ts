import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { PRICING_REGIONS, type PricingRegionId } from "@/lib/pricing-regions";
import {
  amountInPaiseFor,
  describeRazorpayError,
  getRazorpayClient,
  getRequestCountryCode,
  isBillingPeriod,
  isRazorpayPlanType,
  resolveCheckoutRegionId,
} from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as
    | { planType?: string; billingPeriod?: string }
    | null;
  const planType = body?.planType;
  const billingPeriod = body?.billingPeriod;

  if (!planType || !isRazorpayPlanType(planType)) {
    return NextResponse.json({ error: "Invalid or unsupported plan type." }, { status: 400 });
  }
  if (!billingPeriod || !isBillingPeriod(billingPeriod)) {
    return NextResponse.json({ error: "Invalid billing period." }, { status: 400 });
  }
  if (planType === "pro" && billingPeriod === "monthly") {
    return NextResponse.json(
      { error: "Pro Monthly is billed via auto-pay subscription. Use /api/razorpay/create-subscription." },
      { status: 400 },
    );
  }

  const razorpay = getRazorpayClient();
  const admin = getSupabaseServiceRole();
  if (!razorpay || !admin) {
    return NextResponse.json({ error: "Payments are unavailable right now." }, { status: 500 });
  }

  const countryCode = getRequestCountryCode(req);
  const regionId = resolveCheckoutRegionId(countryCode);
  const receipt = `usr_${auth.userId.slice(0, 8)}_${Date.now()}`;
  const notes = { userId: auth.userId, planType, billingPeriod };

  const createOrderIn = (region: PricingRegionId) => {
    const amount = amountInPaiseFor(planType, billingPeriod, region);
    const currency = PRICING_REGIONS[region].currency;
    return razorpay.orders.create({ amount, currency, receipt, notes }).then((order) => ({ order, amount, currency }));
  };

  let created;
  let fellBackToInr = false;
  try {
    created = await createOrderIn(regionId);
    console.info(
      `[razorpay/create-order] Created ${planType}/${billingPeriod} order ${created.order.id} for user ${auth.userId}: ${created.amount / 100} ${created.currency} (caller country ${countryCode ?? "unknown"}).`,
    );
  } catch (err) {
    if (regionId === "india") {
      console.error(
        `[razorpay/create-order] Could not create the INR order for user ${auth.userId}. ${describeRazorpayError(err)}`,
      );
      return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
    }
    // The local currency was refused (most likely not enabled on our Razorpay account yet).
    // Fall back to INR instead of blocking the purchase, and tell the client so it can say so.
    console.warn(
      `[razorpay/create-order] Razorpay refused ${PRICING_REGIONS[regionId].currency} for user ${auth.userId} (country ${countryCode}). ${describeRazorpayError(err)} -- falling back to INR. Ask Razorpay support to enable this currency.`,
    );
    try {
      created = await createOrderIn("india");
      fellBackToInr = true;
    } catch (fallbackErr) {
      console.error(
        `[razorpay/create-order] INR fallback also failed for user ${auth.userId}. ${describeRazorpayError(fallbackErr)}`,
      );
      return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
    }
  }

  const { order, amount, currency } = created;

  const { error: insertError } = await admin.from("razorpay_orders").insert({
    user_id: auth.userId,
    razorpay_order_id: order.id,
    plan_type: planType,
    billing_period: billingPeriod,
    amount_paise: amount,
    currency,
    status: "created",
  });

  if (insertError) {
    console.error(
      `[razorpay/create-order] Order ${order.id} was created at Razorpay but saving it to our database failed (${insertError.message}). Has the "currency" column migration been applied?`,
    );
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    orderId: order.id,
    amount,
    currency,
    fellBackToInr,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}
