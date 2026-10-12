import { PricingPage } from "@/components/pricing/pricing-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, affordable pricing for teachers and schools. Start free with Layah, or upgrade to Pro for unlimited lesson plans, PPTs, worksheets and assessments.",
};

export default function PricingRoutePage() {
  return <PricingPage />;
}
