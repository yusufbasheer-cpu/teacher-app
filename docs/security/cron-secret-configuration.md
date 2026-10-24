# CRON_SECRET secure configuration

Current verified status on 2026-10-24:

- Vercel project: `project-scquo`
- Production: `CRON_SECRET` is not configured.
- Preview branch `experiment/gamma-ppt-integration`: `CRON_SECRET` is not configured.
- No environment variable was created or changed during Phase 1 closure.

The application fails closed while the variable is absent. This protects the endpoint, but the scheduled subscription-maintenance job cannot succeed until the secret is configured on the deployment that owns the cron schedule.

## Value requirements

Create the value in an approved password manager or cryptographically secure secret generator. Use at least 32 random bytes, store it only as a Vercel Sensitive environment variable, and do not place it in source code, `.env.example`, shell history, tickets, chat, or logs.

## Vercel dashboard

1. Open Vercel project `project-scquo`.
2. Open **Settings → Environment Variables**.
3. Add `CRON_SECRET`.
4. Mark it **Sensitive**.
5. Select **Production** for the deployment that runs `vercel.json` cron jobs.
6. Paste the password-manager-generated value and save it.
7. If manual verification is needed on the Gamma branch, add a separate Sensitive Preview value scoped only to `experiment/gamma-ppt-integration`. Do not reuse the Production value.
8. Redeploy the intended target only after deployment approval. Existing deployments do not receive newly added environment variables automatically.

## Vercel CLI

Use the interactive prompt so the value is not present in the command line or shell history:

```powershell
vercel env add CRON_SECRET production --sensitive --project project-scquo
```

Optional branch-scoped Preview value:

```powershell
vercel env add CRON_SECRET preview --git-branch experiment/gamma-ppt-integration --sensitive --project project-scquo
```

Do not use `--value` for this secret. The CLI will prompt for the value securely.

Confirm presence by name only:

```powershell
vercel env ls production --project project-scquo
vercel env ls preview experiment/gamma-ppt-integration --project project-scquo
```

After an approved redeployment, verify that a missing token, a wrong token, a spoofed `x-vercel-cron-schedule` header, and an ordinary user access token return HTTP 401. Verify the correct bearer token through a secret-safe client and do not print the request headers.
