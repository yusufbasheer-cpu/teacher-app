import { AuthCard } from "@/components/auth/auth-card";
import { Container } from "@/components/ui/container";

export default function AuthPage() {
  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <AuthCard />
      </Container>
    </main>
  );
}
