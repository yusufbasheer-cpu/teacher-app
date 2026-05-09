import { FeaturesSection } from "@/components/home/features-section";
import { HeroSection } from "@/components/home/hero-section";

export default function Home() {
  return (
    <main className="min-h-screen pb-16">
      <HeroSection />
      <FeaturesSection />
    </main>
  );
}
