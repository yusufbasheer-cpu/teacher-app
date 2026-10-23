import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthLayout } from "@/components/auth/auth-layout";
import { PageLoader } from "@/components/ui/animate";

export const metadata: Metadata = {
  title: "Log In",
  robots: { index: false, follow: true },
  description:
    "Log in to your Layah account to open your saved lesson plans, PPTs, worksheets, question papers and assessments, and keep planning faster with AI.",
};

export default function LoginPage() {
  return (
    <AuthLayout>
      <Suspense
        fallback={<div className="w-full max-w-[400px]"><PageLoader label="Loading…" /></div>}
      >
        <AuthCard defaultMode="login" linkMode />
      </Suspense>
    </AuthLayout>
  );
}
