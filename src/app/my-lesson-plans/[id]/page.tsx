import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/verified-user";
import { LessonView } from "@/components/lesson-plan/lesson-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LessonViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getVerifiedUser();

  if (!user?.id) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen w-full pb-16 pt-8">
      <LessonView id={id} />
    </main>
  );
}
