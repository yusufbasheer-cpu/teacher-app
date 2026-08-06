// Creates a Razorpay Plan used for Pro Monthly auto-pay subscriptions.
// Run: `node scripts/create-razorpay-pro-plan.cjs [amountInRupees]` (defaults to 349).
// Prints a plan_id -- paste it into RAZORPAY_PRO_PLAN_ID in .env.local and Vercel.
//
// Razorpay Plans are immutable -- each amount needs its own plan. This is also how you make a
// cheap test plan: `node scripts/create-razorpay-pro-plan.cjs 10` creates a real ₹10/30-day plan
// you can point RAZORPAY_PRO_PLAN_ID at temporarily to test the full checkout+webhook loop for
// almost nothing, then switch RAZORPAY_PRO_PLAN_ID back to the real ₹349 plan afterward --
// existing subscribers on a given plan are unaffected when you change which plan new sign-ups use.
const fs = require("fs");
const path = require("path");
const Razorpay = require("razorpay");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env.local");
    process.exit(1);
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  const amountRupees = Number(process.argv[2] ?? 349);
  if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
    console.error("Invalid amount. Usage: node scripts/create-razorpay-pro-plan.cjs [amountInRupees]");
    process.exit(1);
  }

  // period: "daily", interval: 30 -> bills exactly every 30 days (not calendar-month, which
  // would drift between 28-31 days depending on the month).
  const plan = await razorpay.plans.create({
    period: "daily",
    interval: 30,
    item: {
      name: amountRupees === 349 ? "Layah Pro Monthly" : `Layah Pro Monthly (TEST - ₹${amountRupees})`,
      amount: Math.round(amountRupees * 100), // paise
      currency: "INR",
    },
  });

  console.log("Created Razorpay Plan:");
  console.log(plan);
  console.log("\nAdd this to .env.local and Vercel:");
  console.log(`RAZORPAY_PRO_PLAN_ID=${plan.id}`);
}

main().catch((err) => {
  console.error("Failed to create plan:", err);
  process.exit(1);
});
