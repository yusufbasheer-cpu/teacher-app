import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Container } from "@/components/ui/container";

export default function AuthPage() {
  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <Suspense
          fallback={
            <div className="mx-auto max-w-md rounded-3xl border bg-white p-8 text-sm text-slate-600">
              Loading…
            </div>
          }
        >
          <AuthCard />
        </Suspense>
      </Container>
    </main>
  );
}
