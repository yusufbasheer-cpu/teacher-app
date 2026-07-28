/** Geo-based pricing regions for /pricing */

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
      { monthly: 149, annual: 990 },
      { monthly: 349, annual: 2490 },
      { monthly: 599, annual: 4990 },
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
      { monthly: 349, annual: 3490 },
      { monthly: 579, annual: 5790 },
      { monthly: 3499, annual: 23990 },
      { monthly: 8199, annual: 57990 },
      { monthly: 13999, annual: 99990 },
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
      { monthly: 999, annual: 9990 },
      { monthly: 1699, annual: 16990 },
      { monthly: 8999, annual: 89990 },
      { monthly: 19999, annual: 199990 },
      { monthly: 34999, annual: 349990 },
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
      { monthly: 499, annual: 4990 },
      { monthly: 849, annual: 8490 },
      { monthly: 4499, annual: 44990 },
      { monthly: 9999, annual: 99990 },
      { monthly: 16999, annual: 169990 },
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
      { monthly: 1499, annual: 14990 },
      { monthly: 2499, annual: 24990 },
      { monthly: 12999, annual: 129990 },
      { monthly: 28999, annual: 289990 },
      { monthly: 49999, annual: 499990 },
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
      { monthly: 699, annual: 6990 },
      { monthly: 1199, annual: 11990 },
      { monthly: 5999, annual: 59990 },
      { monthly: 13999, annual: 139990 },
      { monthly: 23999, annual: 239990 },
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
      { monthly: 299, annual: 2990 },
      { monthly: 499, annual: 4990 },
      { monthly: 2999, annual: 29990 },
      { monthly: 6999, annual: 69990 },
      { monthly: 11999, annual: 119990 },
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
      { monthly: 79000, annual: 790000 },
      { monthly: 129000, annual: 1290000 },
      { monthly: 799000, annual: 7990000 },
      { monthly: 1799000, annual: 17990000 },
      { monthly: 2999000, annual: 29990000 },
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
      { monthly: 19.99, annual: 199.99 },
      { monthly: 32.99, annual: 329.99 },
      { monthly: 199.99, annual: 1999.99 },
      { monthly: 449.99, annual: 4499.99 },
      { monthly: 749.99, annual: 7499.99 },
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
      { monthly: 3999, annual: 39990 },
      { monthly: 6599, annual: 65990 },
      { monthly: 39999, annual: 399990 },
      { monthly: 89999, annual: 899990 },
      { monthly: 149999, annual: 1499990 },
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
      { monthly: 599, annual: 5990 },
      { monthly: 999, annual: 9990 },
      { monthly: 5999, annual: 59990 },
      { monthly: 13999, annual: 139990 },
      { monthly: 23999, annual: 239990 },
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
      { monthly: 7.99, annual: 79.99 },
      { monthly: 12.99, annual: 129.99 },
      { monthly: 79.99, annual: 799.99 },
      { monthly: 179.99, annual: 1799.99 },
      { monthly: 299.99, annual: 2999.99 },
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
      { monthly: 9.99, annual: 99.99 },
      { monthly: 14.99, annual: 149.99 },
      { monthly: 99.99, annual: 999.99 },
      { monthly: 219.99, annual: 2199.99 },
      { monthly: 369.99, annual: 3699.99 },
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
      { monthly: 11.99, annual: 119.99 },
      { monthly: 18.99, annual: 189.99 },
      { monthly: 124.99, annual: 1249.99 },
      { monthly: 279.99, annual: 2799.99 },
      { monthly: 449.99, annual: 4499.99 },
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
      { monthly: 8.99, annual: 89.99 },
      { monthly: 13.99, annual: 139.99 },
      { monthly: 89.99, annual: 899.99 },
      { monthly: 199.99, annual: 1999.99 },
      { monthly: 329.99, annual: 3299.99 },
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
      { monthly: 12.99, annual: 129.99 },
      { monthly: 19.99, annual: 199.99 },
      { monthly: 129.99, annual: 1299.99 },
      { monthly: 289.99, annual: 2899.99 },
      { monthly: 479.99, annual: 4799.99 },
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
      { monthly: 9999, annual: 99990 },
      { monthly: 16999, annual: 169990 },
      { monthly: 89999, annual: 899990 },
      { monthly: 199999, annual: 1999990 },
      { monthly: 349999, annual: 3499990 },
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
