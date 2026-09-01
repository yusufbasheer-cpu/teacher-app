# Deployment Architecture

## Next Application

- Hosting target: Vercel, inferred from `.vercel/`, `vercel.json`, README, Next config, and Vercel geo header use.
- Production deployment: README says push to `main` deploys to Vercel.
- Preview deployments: `src/proxy.ts` contains explicit notes about Vercel preview hostnames and same-origin CSRF handling.
- Build command: `npm run build`.
- Runtime: Node.js serverless/Next functions; API routes set `runtime = "nodejs"` for routes requiring Node packages.
- Cron: `vercel.json` schedules `GET /api/cron/subscription-maintenance` daily at midnight UTC.
- Security headers/CSP: configured in `next.config.ts`.
- PostHog proxy: `next.config.ts` rewrites `/ingest` to PostHog.

## CI/CD

GitHub Actions workflow `.github/workflows/ci.yml` runs on pull requests and pushes to `main`:

1. checkout
2. setup Node 22 with npm cache
3. `npm ci`
4. `npm run typecheck`
5. `npm run lint`
6. `npm run test`
7. `npm run build` with placeholder Supabase public env vars

## Python PPT API

`python-ppt-api` contains:

- `main.py`: Flask app.
- `requirements.txt`: Python dependencies.
- `Procfile`: likely gunicorn/start command.
- `render.yaml` and `railway.json`: possible hosting configs.

Active deployment platform cannot be proven from repository alone.

## FastAPI Backend (`backend-python/`)

Checkpoint 15 confirmed no deployment configuration exists for
`backend-python`: no `Dockerfile`, `Procfile`, `render.yaml`, `railway.json`,
or CI job that builds/deploys it. `.github/workflows/ci.yml` only covers the
Next app. The only documented way to run it is local (`README.md`:
`python -m uvicorn app.main:app --app-dir backend-python ...`).

Checkpoint 15 ran it locally on `127.0.0.1:8001` (port 8000 was occupied by
an unrelated pre-existing local process) purely for live routing/rollback
verification. The process was stopped afterward; nothing was deployed.
Choosing a real hosting platform for `backend-python` remains open work.

## Infrastructure Gaps

- No Terraform, Pulumi, Kubernetes manifests, Dockerfile, docker-compose, nginx config, serverless config, Netlify config, or Fly config were found.
- Production/staging/preview URLs in the request were placeholders, so environment comparison was not possible.
- Secrets management is platform/environment-variable based but not fully documented in repo.
