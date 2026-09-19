import type { Metadata } from "next";
import { SchoolRegisterForm } from "@/components/school/school-register-form";

export const metadata: Metadata = {
  title: "Register Your School | Layah.ai",
  description: "Bring your teachers together in a Layah school workspace.",
};

export default function SchoolRegisterPage() {
  return (
    <div className="workspace-page">
      <header className="page-header mx-auto !max-w-4xl">
        <div>
          <p className="page-kicker">For schools</p>
          <h1 className="page-title">Set up your school workspace</h1>
          <p className="page-description">Connect your school account, choose a plan, and send your registration for review.</p>
        </div>
      </header>
      <SchoolRegisterForm />
    </div>
  );
}
