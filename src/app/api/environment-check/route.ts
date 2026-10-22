import { NextResponse } from "next/server";
import { checkEnvironmentIsolation } from "@/lib/environment-isolation";
import { experimentFeatureLockReport } from "@/lib/experiment-feature-lock";

export const runtime = "nodejs";

/**
 * Read-only isolation diagnostics for an EXPERIMENTAL environment only (404 everywhere else, so production reveals nothing).
 * Returns non-secret facts and booleans: lets the deployment be verified without reading any (Sensitive) variable.
 * Never returns a key, a tester email, or a Gamma/Razorpay/Supabase secret.
 */
export async function GET(req: Request) {
  const isolation = checkEnvironmentIsolation();
  if (!isolation.isolated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const e = process.env;
  const site = e.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return NextResponse.json(
    {
      isolation,
      featureLock: experimentFeatureLockReport(),
      config: {
        environmentName: e.GAMMA_ENVIRONMENT_NAME ?? null,
        allowedEnvironments: e.GAMMA_ALLOWED_ENVIRONMENTS ?? null,
        allowedSupabaseRefs: e.GAMMA_ALLOWED_SUPABASE_REFS ?? null,
        vercelEnv: e.VERCEL_ENV ?? null,
        gammaExperimentEnabled: e.GAMMA_EXPERIMENT_ENABLED === "true",
        publicGammaExperiment: e.NEXT_PUBLIC_GAMMA_EXPERIMENT === "true",
        defaultProvider: e.PPT_GENERATION_PROVIDER ?? "legacy",
        testerCount: (e.GAMMA_TESTER_EMAILS ?? "").split(",").filter((s) => s.trim()).length,
        gammaKeyPresent: !!e.GAMMA_API_KEY?.trim(),
        exportHostAllowlist: e.GAMMA_EXPORT_HOST_ALLOWLIST ?? null,
        exportHostIsPlaceholder: /\.invalid$/i.test(e.GAMMA_EXPORT_HOST_ALLOWLIST?.trim() ?? ""),
        limits: {
          userHourly: e.GAMMA_USER_HOURLY_LIMIT ?? null,
          userDaily: e.GAMMA_USER_DAILY_LIMIT ?? null,
          dailyCreditBudget: e.GAMMA_DAILY_CREDIT_BUDGET ?? null,
          monthlyCreditBudget: e.GAMMA_MONTHLY_CREDIT_BUDGET ?? null,
          maxCardsPerRun: e.GAMMA_MAX_CARDS_PER_RUN ?? null,
          estimatedCreditsPerRun: e.GAMMA_ESTIMATED_CREDITS_PER_RUN ?? null,
        },
        siteUrl: site ?? null,
        siteUrlMatchesRequestOrigin: !!site && site === new URL(req.url).origin,
        razorpayKeysPresent: !!e.RAZORPAY_KEY_ID?.trim(),
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
