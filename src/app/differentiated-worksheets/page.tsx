import { DifferentiatedWorksheetPack } from "@/components/differentiated-pack/differentiated-worksheet-pack";
import { Container } from "@/components/ui/container";

export default function DifferentiatedWorksheetsPage() {
  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <div className="mb-8 rounded-3xl border border-blue-100 bg-white/90 p-5 shadow-sm sm:p-6 md:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Differentiated Worksheet Pack
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
            Build three leveled worksheets (Foundation, Core, Extension) from your EduPlan lesson or
            from an uploaded plan, with answer keys, rubrics, teacher notes, and peer and self
            assessment sheets—UAE context and curriculum alignment included.
          </p>
        </div>
        <DifferentiatedWorksheetPack />
      </Container>
    </main>
  );
}
