import { getVerifiedUser } from "@/lib/verified-user";
import { QuestionPaperGenerator } from "@/components/question-paper/question-paper-generator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function QuestionPaperPage() {
  await getVerifiedUser();

  // The generator owns its own title, width and signed-out/locked states.
  // This route previously stacked a `PageHeader` above it for signed-in users
  // and a marketing hero for everyone else, so the page always carried two
  // headings for one screen.
  return <QuestionPaperGenerator />;
}
