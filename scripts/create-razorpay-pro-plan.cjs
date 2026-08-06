// One-time setup: creates the Razorpay Plan used for Pro Monthly auto-pay subscriptions.
// Run once: `node scripts/create-razorpay-pro-plan.cjs`
// Prints a plan_id -- paste it into RAZORPAY_PRO_PLAN_ID in .env.local and Vercel.
//
// Razorpay Plans are immutable: if the Pro Monthly price changes later, run this again to
// create a NEW plan and update RAZORPAY_PRO_PLAN_ID -- existing subscribers stay on their
// original plan/price (create-subscription only affects new sign-ups going forward).
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

  // period: "daily", interval: 30 -> bills exactly every 30 days (not calendar-month, which
  // would drift between 28-31 days depending on the month).
  const plan = await razorpay.plans.create({
    period: "daily",
    interval: 30,
    item: {
      name: "Layah Pro Monthly",
      amount: 34900, // paise -- must match src/lib/pricing-regions.ts india.pro.monthly (349) at creation time
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
