import type { Metadata } from "next";
import { ProfileOnboardingForm } from "@/components/onboarding/profile-onboarding-form";

export const metadata: Metadata = {
  title: "Finish Setup | Layah.ai",
  description: "Complete your teacher profile to finish account setup.",
};

export default function OnboardingPage() {
  return (
    <div className="workspace-page !max-w-4xl">
      <header className="page-header">
        <div>
          <p className="page-kicker">Welcome to Layah</p>
          <h1 className="page-title">Make this workspace yours</h1>
          <p className="page-description">Add your name and teaching context. Only your full name is required.</p>
        </div>
      </header>
      <ProfileOnboardingForm />
    </div>
  );
}
