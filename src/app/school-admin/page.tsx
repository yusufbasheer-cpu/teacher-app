import { SchoolAdminDashboard } from "@/components/school/school-admin-dashboard";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";

export default function SchoolAdminPage() {
  return (
    <main className="min-h-screen pb-16 pt-10" style={{ background: "#F7F9FC" }}>
      <Container>
        <FadeIn>
          <SchoolAdminDashboard />
        </FadeIn>
      </Container>
    </main>
  );
}
