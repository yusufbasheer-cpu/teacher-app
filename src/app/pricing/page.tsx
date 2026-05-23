import { PricingPage } from "@/components/pricing/pricing-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing | Layah.ai",
  description:
    "Simple, affordable pricing for teachers. Start free with Layah or upgrade to Pro for unlimited lesson plans, PPTs, worksheets, and more.",
};

export default function PricingRoutePage() {
  return <PricingPage />;
}
