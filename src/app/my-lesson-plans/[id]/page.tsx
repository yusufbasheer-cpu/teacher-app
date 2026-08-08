import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { LessonView } from "@/components/lesson-plan/lesson-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LessonViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen w-full pb-16 pt-8">
      <LessonView id={id} />
    </main>
  );
}
