import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { debugSchoolAdminAccess } from "@/lib/school-admin-server";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const dynamic = "force-dynamic";

function formatDebugValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default async function SchoolAdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/auth");
  }

  const debug = await debugSchoolAdminAccess(user.email);

  console.log("[school-admin page] exact logged-in user email:", user.email);
  console.log("[school-admin page] exact SQL query:", debug.sqlQuery);
  console.log("[school-admin page] exact Supabase result:", debug.result);
  console.log("[school-admin page] Supabase query error:", debug.error);

  return (
    <main className="min-h-screen pb-16 pt-10" style={{ background: "#F7F9FC" }}>
      <Container>
        <div className="mx-auto max-w-3xl rounded-xl border border-amber-300 bg-amber-50 p-6 font-mono text-sm text-slate-900 shadow-sm">
          <h1 className="mb-4 font-sans text-xl font-semibold text-amber-900">
            School admin debug (temporary)
          </h1>
          <dl className="space-y-4">
            <div>
              <dt className="font-sans font-semibold text-slate-700">Logged in as:</dt>
              <dd className="mt-1 whitespace-pre-wrap break-all">{debug.loggedInEmail}</dd>
            </div>
            <div>
              <dt className="font-sans font-semibold text-slate-700">
                Looking for admin with email:
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-all">{debug.lookupEmail}</dd>
            </div>
            <div>
              <dt className="font-sans font-semibold text-slate-700">SQL query:</dt>
              <dd className="mt-1 whitespace-pre-wrap break-all">{debug.sqlQuery}</dd>
            </div>
            <div>
              <dt className="font-sans font-semibold text-slate-700">Service role configured:</dt>
              <dd className="mt-1">{String(debug.serviceRoleConfigured)}</dd>
            </div>
            <div>
              <dt className="font-sans font-semibold text-slate-700">Query result:</dt>
              <dd className="mt-1 whitespace-pre-wrap break-all">
                {formatDebugValue(debug.result)}
              </dd>
            </div>
            <div>
              <dt className="font-sans font-semibold text-slate-700">Plan type valid:</dt>
              <dd className="mt-1">{formatDebugValue(debug.planTypeValid)}</dd>
            </div>
            <div>
              <dt className="font-sans font-semibold text-slate-700">Error if any:</dt>
              <dd className="mt-1 whitespace-pre-wrap break-all text-red-700">
                {debug.error ?? "none"}
              </dd>
            </div>
          </dl>
        </div>
      </Container>
    </main>
  );
}
