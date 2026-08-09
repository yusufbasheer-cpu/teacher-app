/**
 * Geo-based pricing regions for /pricing.
 *
 * Prices are derived from purchasing power and from what people in each
 * region already pay for comparable subscriptions (Netflix, Prime Video),
 * not picked arbitrarily.
 * Method (recomputed 2026-08-09, revised same day):
 *   1. Base layer (unchanged from the original pass): UAE Pro = 15 AED/month
 *      is ~0.099% of UAE's per-capita monthly income (GNI per capita, Atlas
 *      method, World Bank/tradingeconomics.com), applied to every region's
 *      own per-capita income to get an income-fair local price, floored at
 *      $2.99-equivalent/month for Pro so no region prices under the
 *      plausible per-generation AI cost (fal.ai image generation is the
 *      real cost driver, not DeepSeek text). India and GCC/UAE are pinned
 *      to their live, already-billed prices and are never touched by either
 *      pass.
 *   2. Revision: for the higher-income regions (UK, US/CA, Australia,
 *      Europe, Singapore) and Malaysia, checked each region's actual
 *      Netflix Standard / Prime Video price (fetched live this session) —
 *      the income-derived formula in step 1 priced these regions at a small
 *      fraction of what residents already spend on comparable subscriptions,
 *      leaving real margin on the table. Raised these 6 regions to roughly
 *      35-45% of local Netflix Standard price (still a steep discount to
 *      Netflix, e.g. UK ~$5.43 vs Netflix's ~$17.68, US $8.99 vs $19.99) —
 *      Malaysia specifically because its real Netflix price (~MYR 49.90) is
 *      far above what its per-capita-income floor implied, evidence the
 *      linear formula undershot it. The remaining floored regions (Pakistan,
 *      Bangladesh, Sri Lanka, Nepal, Philippines, Indonesia, Nigeria, Kenya,
 *      Myanmar) were deliberately left alone: their Prime Video prices are
 *      at or below the $2.99 floor already (e.g. Nigeria ~$1.67, Philippines
 *      ~$2.41), so matching that benchmark would mean pricing under the
 *      plausible AI-generation cost — the floor exists for a cost reason,
 *      not a formula artifact, so it wins over the amenity comparison there.
 *      Pro Plus/School tiers keep the exact ratio to Pro that the original
 *      GCC table established (25/149/349/599 AED relative to Pro=15), so
 *      every plan still has its own fixed % of Pro, rounded to the nearest
 *      X.99 to match this table's existing style.
 *   3. Annual = monthly * 10 everywhere (2 months free), matching the
 *      convention already used across this table.
 * Recomputing any region here means regenerating its whole row (all 5 plans,
 * monthly + annual), not editing one number in isolation — the Pro Plus/
 * School numbers are derived from Pro, not independent.
 */

import { PLAN_IDS, PLANS, type PlanDefinition, type PlanId } from "@/lib/plans";

export type PricingRegionId =
  | "gcc"
  | "india"
  | "pakistan"
  | "bangladesh"
  | "sri_lanka"
  | "nepal"
  | "philippines"
  | "indonesia"
  | "malaysia"
  | "nigeria"
  | "kenya"
  | "uk"
  | "usd"
  | "australia"
  | "europe"
  | "singapore"
  | "myanmar";

/** Derived from plans.ts — the set of non-null PlanDefinition.priceKey values. */
export type PaidPlanKey = NonNullable<PlanDefinition["priceKey"]>;

export type PlanPricePair = { monthly: number; annual: number };

export type PricingRegion = {
  id: PricingRegionId;
  currency: string;
  currencyName: string;
  selectorLabel: string;
  flag: string;
  decimals: number;
  prices: Record<PaidPlanKey, PlanPricePair>;
};

export const PRICING_STORAGE_KEY = "layah_pricing_region_id";

const p = (
  pro: PlanPricePair,
  proPlus: PlanPricePair,
  schoolStarter: PlanPricePair,
  schoolPro: PlanPricePair,
  schoolEnterprise: PlanPricePair,
): Record<PaidPlanKey, PlanPricePair> => ({
  pro,
  proPlus,
  schoolStarter,
  schoolPro,
  schoolEnterprise,
});

export const PRICING_REGIONS: Record<PricingRegionId, PricingRegion> = {
  gcc: {
    id: "gcc",
    currency: "AED",
    currencyName: "UAE Dirham",
    selectorLabel: "UAE & GCC (AED)",
    flag: "🇦🇪",
    decimals: 0,
    prices: p(
      { monthly: 15, annual: 150 },
      { monthly: 25, annual: 250 },
      { monthly: 149, annual: 1490 },
      { monthly: 349, annual: 3490 },
      { monthly: 599, annual: 5990 },
    ),
  },
  india: {
    id: "india",
    currency: "INR",
    currencyName: "Indian Rupee",
    selectorLabel: "India (INR)",
    flag: "🇮🇳",
    decimals: 0,
    prices: p(
      { monthly: 279, annual: 2790 },
      { monthly: 469, annual: 4690 },
      { monthly: 2829, annual: 28290 },
      { monthly: 6629, annual: 66290 },
      { monthly: 11369, annual: 113690 },
    ),
  },
  pakistan: {
    id: "pakistan",
    currency: "PKR",
    currencyName: "Pakistani Rupee",
    selectorLabel: "Pakistan (PKR)",
    flag: "🇵🇰",
    decimals: 0,
    prices: p(
      { monthly: 829, annual: 8290 },
      { monthly: 1379, annual: 13790 },
      { monthly: 8249, annual: 82490 },
      { monthly: 19319, annual: 193190 },
      { monthly: 33159, annual: 331590 },
    ),
  },
  bangladesh: {
    id: "bangladesh",
    currency: "BDT",
    currencyName: "Bangladeshi Taka",
    selectorLabel: "Bangladesh (BDT)",
    flag: "🇧🇩",
    decimals: 0,
    prices: p(
      { monthly: 369, annual: 3690 },
      { monthly: 619, annual: 6190 },
      { monthly: 3679, annual: 36790 },
      { monthly: 8609, annual: 86090 },
      { monthly: 14779, annual: 147790 },
    ),
  },
  sri_lanka: {
    id: "sri_lanka",
    currency: "LKR",
    currencyName: "Sri Lankan Rupee",
    selectorLabel: "Sri Lanka (LKR)",
    flag: "🇱🇰",
    decimals: 0,
    prices: p(
      { monthly: 999, annual: 9990 },
      { monthly: 1669, annual: 16690 },
      { monthly: 9959, annual: 99590 },
      { monthly: 23329, annual: 233290 },
      { monthly: 40039, annual: 400390 },
    ),
  },
  nepal: {
    id: "nepal",
    currency: "NPR",
    currencyName: "Nepalese Rupee",
    selectorLabel: "Nepal (NPR)",
    flag: "🇳🇵",
    decimals: 0,
    prices: p(
      { monthly: 459, annual: 4590 },
      { monthly: 759, annual: 7590 },
      { monthly: 4529, annual: 45290 },
      { monthly: 10599, annual: 105990 },
      { monthly: 18199, annual: 181990 },
    ),
  },
  philippines: {
    id: "philippines",
    currency: "PHP",
    currencyName: "Philippine Peso",
    selectorLabel: "Philippines (PHP)",
    flag: "🇵🇭",
    decimals: 0,
    prices: p(
      { monthly: 179, annual: 1790 },
      { monthly: 299, annual: 2990 },
      { monthly: 1809, annual: 18090 },
      { monthly: 4229, annual: 42290 },
      { monthly: 7269, annual: 72690 },
    ),
  },
  indonesia: {
    id: "indonesia",
    currency: "IDR",
    currencyName: "Indonesian Rupiah",
    selectorLabel: "Indonesia (IDR)",
    flag: "🇮🇩",
    decimals: 0,
    prices: p(
      { monthly: 53000, annual: 530000 },
      { monthly: 89000, annual: 890000 },
      { monthly: 530000, annual: 5300000 },
      { monthly: 1242000, annual: 12420000 },
      { monthly: 2132000, annual: 21320000 },
    ),
  },
  malaysia: {
    id: "malaysia",
    currency: "MYR",
    currencyName: "Malaysian Ringgit",
    selectorLabel: "Malaysia (MYR)",
    flag: "🇲🇾",
    decimals: 2,
    prices: p(
      { monthly: 18.99, annual: 189.9 },
      { monthly: 31.99, annual: 319.9 },
      { monthly: 188.99, annual: 1889.9 },
      { monthly: 441.99, annual: 4419.9 },
      { monthly: 757.99, annual: 7579.9 },
    ),
  },
  nigeria: {
    id: "nigeria",
    currency: "NGN",
    currencyName: "Nigerian Naira",
    selectorLabel: "Nigeria (NGN)",
    flag: "🇳🇬",
    decimals: 0,
    prices: p(
      { monthly: 4079, annual: 40790 },
      { monthly: 6799, annual: 67990 },
      { monthly: 40509, annual: 405090 },
      { monthly: 94889, annual: 948890 },
      { monthly: 162859, annual: 1628590 },
    ),
  },
  kenya: {
    id: "kenya",
    currency: "KES",
    currencyName: "Kenyan Shilling",
    selectorLabel: "Kenya (KES)",
    flag: "🇰🇪",
    decimals: 0,
    prices: p(
      { monthly: 389, annual: 3890 },
      { monthly: 639, annual: 6390 },
      { monthly: 3839, annual: 38390 },
      { monthly: 8999, annual: 89990 },
      { monthly: 15449, annual: 154490 },
    ),
  },
  uk: {
    id: "uk",
    currency: "GBP",
    currencyName: "British Pound",
    selectorLabel: "United Kingdom (GBP)",
    flag: "🇬🇧",
    decimals: 2,
    prices: p(
      { monthly: 3.99, annual: 39.9 },
      { monthly: 6.99, annual: 69.9 },
      { monthly: 39.99, annual: 399.9 },
      { monthly: 92.99, annual: 929.9 },
      { monthly: 158.99, annual: 1589.9 },
    ),
  },
  usd: {
    id: "usd",
    currency: "USD",
    currencyName: "US Dollar",
    selectorLabel: "USA & Canada (USD)",
    flag: "🇺🇸",
    decimals: 2,
    prices: p(
      { monthly: 8.99, annual: 89.9 },
      { monthly: 14.99, annual: 149.9 },
      { monthly: 88.99, annual: 889.9 },
      { monthly: 208.99, annual: 2089.9 },
      { monthly: 358.99, annual: 3589.9 },
    ),
  },
  australia: {
    id: "australia",
    currency: "AUD",
    currencyName: "Australian Dollar",
    selectorLabel: "Australia (AUD)",
    flag: "🇦🇺",
    decimals: 2,
    prices: p(
      { monthly: 8.99, annual: 89.9 },
      { monthly: 14.99, annual: 149.9 },
      { monthly: 88.99, annual: 889.9 },
      { monthly: 208.99, annual: 2089.9 },
      { monthly: 358.99, annual: 3589.9 },
    ),
  },
  europe: {
    id: "europe",
    currency: "EUR",
    currencyName: "Euro",
    selectorLabel: "Europe (EUR)",
    flag: "🇪🇺",
    decimals: 2,
    prices: p(
      { monthly: 4.99, annual: 49.9 },
      { monthly: 7.99, annual: 79.9 },
      { monthly: 49.99, annual: 499.9 },
      { monthly: 115.99, annual: 1159.9 },
      { monthly: 198.99, annual: 1989.9 },
    ),
  },
  singapore: {
    id: "singapore",
    currency: "SGD",
    currencyName: "Singapore Dollar",
    selectorLabel: "Singapore (SGD)",
    flag: "🇸🇬",
    decimals: 2,
    prices: p(
      { monthly: 8.99, annual: 89.9 },
      { monthly: 14.99, annual: 149.9 },
      { monthly: 88.99, annual: 889.9 },
      { monthly: 208.99, annual: 2089.9 },
      { monthly: 358.99, annual: 3589.9 },
    ),
  },
  myanmar: {
    id: "myanmar",
    currency: "MMK",
    currencyName: "Myanmar Kyat",
    selectorLabel: "Myanmar (MMK)",
    flag: "🇲🇲",
    decimals: 0,
    prices: p(
      { monthly: 6279, annual: 62790 },
      { monthly: 10469, annual: 104690 },
      { monthly: 62429, annual: 624290 },
      { monthly: 146219, annual: 1462190 },
      { monthly: 250969, annual: 2509690 },
    ),
  },
};

export const PRICING_REGION_LIST = Object.values(PRICING_REGIONS);

const GCC_COUNTRIES = new Set(["AE", "BH", "KW", "OM", "QA", "SA"]);
const USD_COUNTRIES = new Set(["US", "CA"]);
const EUR_COUNTRIES = new Set([
  "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT",
  "LU", "LV", "MT", "NL", "PT", "SI", "SK", "BG", "RO", "CZ", "DK", "HU", "PL",
  "SE", "LI", "MC", "AD", "SM", "VA",
]);

const COUNTRY_NAMES: Record<string, string> = {
  AE: "UAE",
  BH: "Bahrain",
  KW: "Kuwait",
  OM: "Oman",
  QA: "Qatar",
  SA: "Saudi Arabia",
  IN: "India",
  PK: "Pakistan",
  BD: "Bangladesh",
  LK: "Sri Lanka",
  NP: "Nepal",
  PH: "Philippines",
  ID: "Indonesia",
  MY: "Malaysia",
  NG: "Nigeria",
  KE: "Kenya",
  GB: "United Kingdom",
  US: "United States",
  CA: "Canada",
  AU: "Australia",
  SG: "Singapore",
  MM: "Myanmar",
};

const COUNTRY_FLAGS: Record<string, string> = {
  AE: "🇦🇪",
  BH: "🇧🇭",
  KW: "🇰🇼",
  OM: "🇴🇲",
  QA: "🇶🇦",
  SA: "🇸🇦",
  IN: "🇮🇳",
  PK: "🇵🇰",
  BD: "🇧🇩",
  LK: "🇱🇰",
  NP: "🇳🇵",
  PH: "🇵🇭",
  ID: "🇮🇩",
  MY: "🇲🇾",
  NG: "🇳🇬",
  KE: "🇰🇪",
  GB: "🇬🇧",
  US: "🇺🇸",
  CA: "🇨🇦",
  AU: "🇦🇺",
  SG: "🇸🇬",
  MM: "🇲🇲",
};

export function isPricingRegionId(value: string): value is PricingRegionId {
  return value in PRICING_REGIONS;
}

export function getRegionForCountryCode(countryCode: string | null | undefined): PricingRegionId {
  const cc = (countryCode ?? "").toUpperCase();
  if (!cc) return "usd";
  if (GCC_COUNTRIES.has(cc)) return "gcc";
  if (cc === "IN") return "india";
  if (cc === "PK") return "pakistan";
  if (cc === "BD") return "bangladesh";
  if (cc === "LK") return "sri_lanka";
  if (cc === "NP") return "nepal";
  if (cc === "PH") return "philippines";
  if (cc === "ID") return "indonesia";
  if (cc === "MY") return "malaysia";
  if (cc === "NG") return "nigeria";
  if (cc === "KE") return "kenya";
  if (cc === "GB") return "uk";
  if (USD_COUNTRIES.has(cc)) return "usd";
  if (cc === "AU") return "australia";
  if (EUR_COUNTRIES.has(cc)) return "europe";
  if (cc === "SG") return "singapore";
  if (cc === "MM") return "myanmar";
  return "usd";
}

export function getCountryDisplayName(countryCode: string | null | undefined): string {
  const cc = (countryCode ?? "").toUpperCase();
  return COUNTRY_NAMES[cc] ?? (cc || "your region");
}

export function getCountryFlag(countryCode: string | null | undefined, region: PricingRegion): string {
  const cc = (countryCode ?? "").toUpperCase();
  return COUNTRY_FLAGS[cc] ?? region.flag;
}

function formatNumber(amount: number, decimals: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format a price with the correct currency symbol for the region. */
export function formatRegionalPrice(
  region: PricingRegion,
  amount: number,
  period: "month" | "year",
): string {
  const n = formatNumber(amount, region.decimals);
  const suffix = period === "month" ? "month" : "year";
  const c = region.currency;

  switch (c) {
    case "GBP":
      return `£${n} / ${suffix}`;
    case "USD":
      return `$${n} / ${suffix}`;
    case "EUR":
      return `€${n} / ${suffix}`;
    case "AUD":
      return `$${n} AUD / ${suffix}`;
    case "SGD":
      return `$${n} SGD / ${suffix}`;
    case "INR":
      return `₹${n} / ${suffix}`;
    case "PKR":
      return `Rs ${n} / ${suffix}`;
    case "BDT":
      return `৳${n} / ${suffix}`;
    case "NGN":
      return `₦${n} / ${suffix}`;
    case "PHP":
      return `₱${n} / ${suffix}`;
    case "MYR":
      return `RM ${n} / ${suffix}`;
    case "IDR":
      return `Rp ${n} / ${suffix}`;
    default:
      return `${n} ${c} / ${suffix}`;
  }
}

/** Resolves a /pricing slug (e.g. "pro-plus") to its PRICING_REGIONS price key, via plans.ts. */
export function getPlanPriceKey(planSlug: string): PaidPlanKey | null {
  const id = PLAN_IDS.find((planId: PlanId) => PLANS[planId].slug === planSlug);
  return id ? PLANS[id].priceKey : null;
}
