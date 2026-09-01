# Migration Decisions

This file is append-only. Do not edit prior decisions; add superseding decisions below.

## 2026-08-31

Decision: Use a three-repository target architecture by default: frontend, backend-python, and AI services.

Reason: The current code has substantial AI provider orchestration that is cost-sensitive and independently evolvable, while billing/auth/admin/data concerns belong in a backend service.

Alternatives considered: Two repos (`frontend`, `backend-python`) with AI embedded in backend.

Impact: Migration plan must define backend-to-AI contracts and keep auth/usage source of truth in backend.

Status: Proposed.

## 2026-08-31

Decision: Keep the frontend in Next.js/React/TypeScript during migration.

Reason: Existing product is implemented in Next App Router with many working UI flows; rewrite would increase risk without solving boundary issues.

Alternatives considered: Rewriting frontend during split.

Impact: First migration step is API boundary stabilization, not UI rewrite.

Status: Proposed.

## 2026-08-31

Decision: Recommend FastAPI for the Python backend.

Reason: Current APIs are HTTP/JSON with some streaming and many typed request/response shapes; FastAPI/Pydantic fits API-compatible migration and OpenAPI contract generation.

Alternatives considered: Django, Flask-only, serverless Python functions.

Impact: Backend migration plan assumes FastAPI, Pydantic, HTTPX, Supabase JWT verification, and optional SQLAlchemy/Alembic.

Status: Proposed.

## 2026-08-31

Decision: Stabilize the frontend-to-backend API boundary before any broad frontend service abstraction work.

Reason: The current browser code already has many local API calls, but the boundary is inconsistent and mixed with direct Supabase usage. A single client abstraction should represent `Frontend -> our backend API`, not a generic transport layer.

Alternatives considered: Migrating external provider calls and frontend Supabase access into the same first pass.

Impact: Checkpoint 2 should focus on a minimal API client plus contract tests, while preserving separate handling for external providers and direct Supabase auth/session behavior.

Status: Proposed.

## 2026-08-31

Decision: Do not treat `saved_lessons` as the first browser-side Supabase mutation to migrate.

Reason: The contract is migration critical and spans generation, reload, list, and delete flows. `lesson_plans` save/update is the lower-risk first candidate unless later contract analysis shows an even safer mutation.

Alternatives considered: Starting with `saved_lessons` auto-save because it is user-visible and nearby in the generator flow.

Impact: Phase 1 recommendations should name `lesson_plans` save/update as the first candidate for detailed contract hardening.

Status: Proposed.

## 2026-08-31

Decision: Migrate `lesson_plans` save/update behind a backend API route before touching `saved_lessons`.

Reason: The contract is narrower, the call surface is smaller, and it lets us prove the frontend API boundary without moving migration-critical lesson auto-save behavior yet.

Alternatives considered: Moving `saved_lessons` first or bundling both lesson persistence paths into the same diff.

Impact: The first production-code persistence boundary now lives in `POST /api/lesson-plan/save`, while `saved_lessons` remains browser-owned for later review.

Status: Implemented.

## 2026-09-01

Decision: Refuse real Supabase RLS mutation tests unless the target is explicitly marked local, dedicated test, or controlled staging.

Reason: The repository has Supabase migrations and a schema snapshot, but no runnable local Supabase config/runtime was available, and the only present `.env.local` Supabase project had no non-production marker. Running authenticated write tests against an ambiguous project would violate the migration safety rules.

Alternatives considered: Using the existing `.env.local` credentials, assuming the hosted project was safe, or skipping integration infrastructure entirely.

Impact: Checkpoint 9 adds a guarded integration harness and blocker documentation, but `POST /api/lesson-plan/save` remains `PYTHON_PARITY` until the harness passes against a proven non-production Supabase environment.

Status: Implemented.

## 2026-08-31

Decision: Introduce an internal AI facade before physically reorganizing provider modules.

Reason: A thin facade lets application code depend on one internal boundary while preserving the existing DeepSeek, fal, and Pexels helper implementations unchanged.

Alternatives considered: Moving provider files immediately, or leaving the direct imports in place until the AI service split.

Impact: `src/lib/ai-facade.ts` now serves as the dependency-inversion layer for selected question-paper and PPT image paths, without changing prompts, model IDs, or provider payloads.

Status: Implemented.

## 2026-08-31

Decision: Treat the lesson-plan save flow as the first proven authenticated persistence service boundary.

Reason: The route already preserves caller-context Supabase access and RLS, and the service module stays focused on insert/update semantics without HTTP concerns.

Alternatives considered: Moving `saved_lessons` first, introducing a generic repository layer, or pushing service-role persistence into the boundary.

Impact: `src/lib/lesson-plan-save.ts` is now documented as a server-only service seam, and the route/service split has a concrete reference implementation for the later FastAPI migration.

Status: Implemented.

## 2026-08-31

Decision: Keep backend service extraction focused on low-risk stateless helpers first.

Reason: The route surface still contains high-risk billing, auth, quota, and AI flows. Starting with geo lookup proves the service boundary pattern without changing business-side behavior.

Alternatives considered: Extracting service helpers from billing, school admin, or lesson-generation routes first.

Impact: `src/app/api/geo/route.ts` now delegates to `src/lib/geo-service.ts` with behavior preserved.

Status: Implemented.

## 2026-08-31

Decision: Move lesson-plan DeepSeek transport behind a lesson-specific provider before broader AI service cleanup.

Reason: The lesson route already owns high-risk policy, quota, streaming, and persistence concerns. Extracting only the DeepSeek request/response mechanics reduces surface area without changing prompts, models, or output envelopes.

Alternatives considered: Leaving the fetches inline until a larger AI refactor or moving all lesson orchestration into the provider.

Impact: `src/lib/deepseek-lesson-provider.ts` now owns the lesson DeepSeek HTTP contract, while `src/app/api/lesson-plan/route.ts` keeps business orchestration and response shaping.

Status: Implemented.

## 2026-09-01

Decision: Implement the first FastAPI authenticated endpoint as a no-cutover `lesson-plan/save` parity pilot using Supabase Auth validation plus caller-token PostgREST requests.

Reason: The browser already sends a bearer token, Supabase Auth provides the project-compatible validation boundary, and forwarding that token preserves RLS without introducing service-role persistence or guessed local JWT configuration.

Alternatives considered: Local JWT/JWKS verification before the Supabase signing configuration was established, service-role writes, direct Postgres access, or moving frontend traffic.

Impact: Python unit-contract parity is demonstrated; real isolated Supabase RLS integration and all production cutover work remain separate requirements.

Status: Implemented.

## 2026-09-01

Decision: Keep `POST /api/lesson-plan/save` at `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER` after Checkpoint 10.

Reason: The existing `.env.local` Supabase project is real but unclassified, CI uses placeholder Supabase values, and local Supabase cannot be started from current repo/tooling. No target could be positively identified as local, dedicated test, or controlled staging.

Alternatives considered: Running the guarded harness against `.env.local`, creating a hosted Supabase project automatically, or weakening the harness to accept unknown environments.

Impact: No unsafe mutation occurred. Cutover candidacy is blocked only by provisioning/identifying a safe Supabase RLS integration environment and running the existing harness successfully.

Status: Implemented.

## 2026-09-01

Decision: Do not add a local Supabase config or baseline migration until `lesson_plans` schema-source drift is resolved.

Reason: Checkpoint 11 found that Supabase CLI and Docker are unavailable in the current workspace, and the tracked migration chain does not create `public.lesson_plans` before later migrations alter it. Adding a reduced local table or choosing `schema.sql` over migrations without reconciliation would produce misleading RLS evidence.

Alternatives considered: Creating a minimal `supabase/config.toml` immediately, adding a new baseline migration for only `lesson_plans`, loading `schema.sql` manually, or running the harness against the unclassified `.env.local` hosted project.

Impact: The integration harness local guard is stricter, local env documentation exists, and the exact schema/tooling blocker is documented. `POST /api/lesson-plan/save` remains `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER`.

Status: Implemented.

## 2026-09-01

Decision: Use `HYBRID_TRANSITION_REQUIRED` as the current database source-of-truth strategy.

Reason: `supabase/schema.sql` is the only tracked source for the `lesson_plans` base table and owner-RLS contract, while ordered migrations represent many later changes but miss early baseline objects such as `lesson_plans` and `saved_lessons`. Some schema still exists as application-comment SQL, notably `school_templates`.

Alternatives considered: Declaring migrations canonical immediately, declaring `schema.sql` canonical permanently, or adding a copied `lesson_plans` migration without resolving broader baseline drift.

Impact: No migration SQL was created in Checkpoint 12. Static RLS invariant coverage was added, but live local RLS verification and cutover candidacy remain blocked until the schema baseline is reconciled.

Status: Implemented.

## 2026-09-01 (Checkpoint 15)

Decision: Verify the Checkpoint 14 geo routing seam live using a local FastAPI process instead of a deployed environment, and classify the outcome `VALIDATED_BUT_LEFT_ON_NEXT`.

Reason: `backend-python` has no deployment configuration anywhere in the repository (no Dockerfile, Procfile, render.yaml, railway.json, or CI deploy job), and no `PYTHON_BACKEND_URL`/`BACKEND_ROUTE_GEO` value exists in any env file. Inventing new infrastructure is out of scope for this checkpoint. The documented "safe environment priority" places local Next + local FastAPI first, and it was sufficient to prove routing, security, contract parity, transport fallback, and rollback end-to-end.

Alternatives considered: Provisioning a new hosting platform for `backend-python` to enable a "real" cutover; skipping live verification and relying only on Checkpoint 14's automated tests.

Impact: The geo routing mechanism is now proven correct end-to-end with live evidence (not just unit tests), but Python routing was not left enabled in any persisted configuration because no deployed target exists to leave it enabled against. Choosing/provisioning a real FastAPI hosting platform is separate, future work.

Status: Implemented.

## 2026-09-01 (Checkpoint 16)

Decision: Recommend Render (not yet provisioned) as the technically preferred FastAPI deployment platform, over Railway and Vercel-Python, without finalizing the choice.

Reason: The only repository evidence of platform intent is the unrelated legacy `python-ppt-api` service's two drafted-but-unused configs (`render.yaml` and `railway.json`, added in the same commit, never iterated on, no proven live URL). Render's config is the more explicit/self-documenting of the two. Vercel-Python was considered given existing account access for the frontend, but adopting it changes the two-repo hosting topology this migration is deliberately building toward and requires an interactive `vercel login` this session cannot perform. No Render/Railway/Vercel credentials are available in this session, so no platform choice could be finalized as a business/cost decision — only recommended.

Alternatives considered: Railway (equally plausible, deferred as documented fallback with portable commands), Vercel Fluid Compute Python hosting (deferred, topology-changing), Docker/self-managed (rejected, unnecessary complexity, Docker unavailable locally anyway).

Impact: `backend-python/render.yaml` documents the intended Render service config and was validated locally (`pip install --dry-run ./backend-python` resolves cleanly). No account was created, no deployment occurred. Geo remains `CUTOVER_VALIDATED`, not `CUTOVER_ACTIVE`.

Status: Implemented (repository-side only; external provisioning remains open).

## 2026-09-01 (Checkpoint 16)

Decision: Add lightweight request-ID + duration logging middleware to `backend-python`, but defer Next→Python request-ID propagation and defer adding Sentry to Python.

Reason: Checkpoint 16 requires enough operational visibility to safely route endpoints to Python, without building a distributed-tracing stack. A single-process middleware (generate or safely echo `x-request-id`, log method/path/status/duration, log exceptions without leaking them to the client) meets that bar with ~50 lines of testable code and zero new dependencies. Propagating the ID from Next through the existing geo proxy would touch frontend code and add cross-service coordination that isn't justified yet for a single-hop, geo-only, unshipped pilot. No Sentry Python dependency/config exists anywhere in the repo, so adding one would not be "trivial and non-invasive" as required.

Alternatives considered: Full request-ID propagation from Next through `buildGeoProxyHeaders`; adding `sentry-sdk` to `backend-python`; using only Uvicorn's default access log with no additional structure.

Impact: `backend-python/app/observability.py` plus five new tests in `backend-python/tests/test_observability.py`. `PYTHON_SENTRY_DEFERRED` and Next-side request-ID propagation are both explicitly documented as deferred, not silently skipped, in `FASTAPI_DEPLOYMENT_RUNBOOK.md`.

Status: Implemented (middleware); propagation and Sentry explicitly deferred, not implemented.

## 2026-09-01 (Checkpoint 17)

Decision: Do not provision a remote FastAPI deployment this checkpoint; classify as `EXTERNAL_PROVISIONING_BLOCKED` and stop before any resource creation.

Reason: Checkpoint 16 recommended Render (not yet provisioned) and left the exact remaining external steps documented. Checkpoint 17's authorization rule requires confirming platform account access, authorization, target-environment clarity, and cost implications before creating any external resource. This session has no Render, Railway, or Vercel CLI, MCP tool, or credential available, and no prior session confirmed Render/Railway account access for this project (only Vercel and Supabase dashboard access were previously confirmed). Proceeding without that access would mean either fabricating verification or attempting resource creation without authorization, both explicitly disallowed.

Alternatives considered: Falling back to Railway (same access gap applies — no credentials for either platform); attempting Vercel Python hosting (same gap, plus the topology-change concern already raised in Checkpoint 16); simulating/fabricating remote verification results (explicitly disallowed).

Impact: No repository runtime/config changes were needed — Checkpoint 16's deployment readiness was re-verified and remains valid as-is. Only documentation was updated to record the attempt and the exact human action still required (a person with Render, or an authorized alternative platform, account access must create the service and share the resulting URL). Geo remains `CUTOVER_VALIDATED`; `GET /api/geo` continues to serve from Next.

Status: Blocked, pending external human action. Not implemented.

## 2026-09-01 (Checkpoint 18)

Decision: Select `POST /api/auth/verify-captcha` as the second Track B (non-DB) FastAPI parity pilot, from a 5-candidate shortlist, and re-classify `feedback`/`waitlist`/`school-register` from `PYTHON_PARITY` to `NEXT_ONLY`.

Reason: Reading `API_INVENTORY.md`'s endpoint-group table produced a shortlist of `verify-captcha`, `contact`, `feedback`, `waitlist`, `school-register` as the only public, non-admin, non-AI, non-billing candidates. Reading each route's actual source (not just the audit summary) showed the audit's own "low-risk public form handler" label for contact/feedback/waitlist/school-register undersold their real dependencies: `feedback`, `waitlist`, and `school-register` all perform a privileged Supabase `service_role` insert of real user data, and `contact`/`feedback`/`school-register` also send a real email via SMTP. Only `verify-captcha` has zero Supabase dependency, zero mutation, and zero SMTP dependency — a single bounded call to one external provider (Cloudflare Turnstile) with an already-optional, already-documented secret.

Alternatives considered: `contact` (rejected — real SMTP send side effect, new secret category); `feedback`/`waitlist`/`school-register` (rejected — privileged Supabase writes, explicitly excluded by this checkpoint's eligibility bar); lowering the safety bar to force a "cleaner" pick — rejected per the checkpoint's explicit instruction not to do this.

Impact: `docs/migration-audit/VERIFY_CAPTCHA_PYTHON_PARITY_CONTRACT.md` freezes the contract. `feedback`/`waitlist`/`school-register` are re-classified `NEXT_ONLY` in `BACKEND_MIGRATION_MANIFEST.md` pending a mutation-safe migration pattern (analogous to `lesson-plan/save`'s caller-context approach) — this is a documentation correction reflecting what their source actually does, not a behavior change to those routes.

Status: Implemented.

## 2026-09-01 (Checkpoint 18)

Decision: Implement Python parity for `verify-captcha` with a shared JSON contract fixture (`contract-fixtures/verify-captcha/`), and preserve two unhandled-exception edge cases in the existing Next code as designed `400` responses in Python rather than reproducing the crashes.

Reason: The existing Next route has two paths where a non-string or `null` top-level `token` value causes an uncaught `TypeError` outside its only try/catch, producing Next's default `500`. No real caller can trigger this (the frontend always sends `{ token: string }`), so it is not designed behavior worth bit-for-bit reproduction — doing so would mean deliberately writing a Python crash path to match an accidental one. The shared-fixture pattern already established for geo (`contract-fixtures/geo/`) extends cleanly to a POST-with-body endpoint.

Alternatives considered: Reproducing the exact unhandled-exception `500` in Python (rejected — no value, and Python's own type system makes an equivalent accidental crash awkward to construct deliberately); skipping shared fixtures and writing independent Node/Python test data (rejected — the existing pattern's whole value is one JSON file both suites read, and it already caught nothing at odds between the two implementations).

Impact: `backend-python/app/services/verify_captcha.py`, `backend-python/app/api/routes/verify_captcha.py`, `backend-python/tests/test_verify_captcha.py`, `contract-fixtures/verify-captcha/verify-captcha-contract.json`. Both Node and Python test suites pass every shared case on first run.

Status: Implemented.

## 2026-09-01 (Checkpoint 18)

Decision: Generalize `src/lib/backend-routing.ts` to a second allowlisted endpoint (`verify-captcha`, via `BACKEND_ROUTE_VERIFY_CAPTCHA`), but give it no transport-fallback to Next — unlike geo.

Reason: All of this checkpoint's routing-eligibility criteria were met (low risk, no mutation, no auth, no quota/billing, no streaming, no user-specific persistence, Python contract proven, straightforward rollback), so adding a disabled-by-default routing seam was justified rather than deferred. However, Cloudflare Turnstile tokens are single-use: if Python's call to Turnstile succeeded but the response back to Next then failed at the transport level, blindly falling back to Next would resubmit the same token and get a false `timeout-or-duplicate` rejection — turning a valid captcha completion into an apparent failure the caller never caused. Geo's fallback is safe only because it's a pure idempotent read with no external side effect to duplicate; that reasoning does not transfer here.

Alternatives considered: Reusing geo's exact fallback-to-Next behavior (rejected — the single-use-token risk above); adding no routing seam at all, i.e. stopping at `PYTHON_PARITY` (also acceptable per the checkpoint's own success criteria, but the routing-eligibility checklist was fully satisfied, so the more complete `ROUTING_READY` outcome was chosen); building a generic per-endpoint fallback-policy configuration (rejected — unjustified abstraction for two endpoints, one line of route-specific logic is clearer).

Impact: `src/lib/backend-routing.ts` now maps each endpoint to its own env var and upstream path via fixed records instead of a single hardcoded `"geo"` branch; all existing geo tests pass unchanged, proving the generalization didn't alter geo's behavior. `src/app/api/auth/verify-captcha/route.ts` proxies to Python when configured and returns a `502` on transport failure instead of falling back — covered by a dedicated test asserting exactly one `fetch` call occurred (no second, silent call to Turnstile via Next). Configuration was never persisted; default remains Next for both endpoints.

Status: Implemented.

## 2026-09-01 (Checkpoint 19)

Decision: Provision the first real remote FastAPI target on Vercel, under the teammate's (`yusufbasheer-cpu`) personal Vercel account, only after asking the user directly and receiving explicit authorization — rather than either proceeding silently or refusing outright.

Reason: This checkpoint's safety rule requires establishing account ownership, authorization, cost implications, and environment classification before creating any external resource. `vercel teams ls` showed the only authenticated scope, "teacher-app", is literally labeled "Mohammed Yusuf's projects" — a personal account, not a neutral shared team, despite Uvais having separately-confirmed Vercel dashboard access. Render and Railway remained completely unavailable (no CLI, no credentials, confirmed again). This is exactly the "account ownership materially ambiguous" case the checkpoint says to stop for. Since the user was actively present in the conversation and the ambiguity was resolvable in one message, asking directly was more useful than silently blocking and ending the checkpoint — auto-mode explicitly permits stopping for a genuine human decision.

Alternatives considered: Proceeding without asking (rejected — exactly the "do not guess" case this checkpoint warns against); refusing and classifying `PROVISIONING_AUTHORIZATION_BLOCKED` without asking (rejected — the ambiguity was fast to resolve and the user was present, so this would have wasted a round-trip); waiting for Render/Railway credentials instead (still the documented preference, but no timeline for when those would appear, and the user chose to proceed with Vercel now).

Impact: User explicitly authorized "Proceed under Yusuf's Vercel account." A new, separate Vercel project (`layah-backend-python`) was created, fully isolated from `project-scquo` (separate `.vercel/project.json` link scoped to `backend-python/` only; root `.vercel/repo.json` untouched; confirmed unmodified via `vercel project ls` before and after). See `FASTAPI_REMOTE_DEPLOYMENT.md` for the resulting deployment record.

Status: Implemented.

## 2026-09-01 (Checkpoint 19)

Decision: Add an explicit `entrypoint` to the service block in `backend-python/vercel.json` (and, redundantly but harmlessly, `[tool.vercel.entrypoint]` in `pyproject.toml`), after the first two deploy attempts failed.

Reason: Vercel's documented Python entrypoint auto-detection ("same filenames inside `src/` or `app/`") should have matched `backend-python/app/main.py`'s module-level `app` object with zero config. The actual deploy failed both before and after adding the `pyproject.toml` declaration, with: `"detected framework \"fastapi\" in \".\" and must specify an \"entrypoint\" for runtime \"python\"."` Fetching Vercel's own Services documentation showed the reason: `vercel link` wrapped this project in Services mode (`vercel.json`'s `services` key), and in that mode the entrypoint must be declared inside the service's own config block — the `pyproject.toml`-level mechanism is for the non-Services case only.

Alternatives considered: Restructuring the project out of Services mode (rejected — more invasive than necessary, and Services mode is what `vercel link` produced by default for this CLI-created project); guessing at other config shapes without checking documentation first (rejected — this is real external infrastructure, and burning deploy attempts on guesses wastes time and risks confusing failure states).

Impact: `backend-python/vercel.json`'s service block now has `"entrypoint": "app.main:app"`. Third deploy attempt succeeded. No application code changed; local `uvicorn`/pytest/ruff behavior confirmed unaffected (`pip install --dry-run`, full local test suite, ruff all still pass after the change).

Status: Implemented.

## 2026-09-01 (Checkpoint 20)

Decision: Add a narrow, inert-by-default Deployment Protection bypass mechanism (`applyDeploymentProtectionBypass`) to the routing proxy, rather than disabling or weakening the backend's Vercel Deployment Protection.

Reason: The backend Preview has Vercel SSO/Deployment Protection enabled by default, so a plain server-side `fetch()` from Next hit Vercel's own login page instead of the FastAPI function. The checkpoint's own instruction was explicit: investigate the narrow supported mechanism rather than disabling security broadly. Vercel's own documentation names exactly this mechanism — "Protection Bypass for Automation," activated via an `x-vercel-protection-bypass` header carrying a project-scoped secret, expressly intended for automated/server-to-server access to protected deployments.

Alternatives considered: Disabling Deployment Protection on the backend project entirely (rejected — exactly the "broadly less secure" outcome the checkpoint forbids); promoting the backend to Production to escape protection (rejected — the checkpoint explicitly forbids promoting before Preview validation completes); accepting the block and classifying the checkpoint `REMOTE_ROUTING_BLOCKED` without investigating further (rejected — a documented, narrow, reversible mechanism existed and hadn't been tried yet).

Impact: `src/lib/backend-routing.ts` gained `applyDeploymentProtectionBypass()`, wired into both `geo/route.ts` and `verify-captcha/route.ts`. No-op unless `PYTHON_BACKEND_BYPASS_SECRET` is explicitly set, so production behavior is unaffected. Verified end-to-end against the real backend; 4 new tests added. Deployment Protection itself was never disabled or weakened — it remains fully enabled throughout.

Status: Implemented.

## 2026-09-01 (Checkpoint 20)

Decision: Rotate the Vercel "Protection Bypass for Automation" secret immediately after it was accidentally exposed in tool output, with the user's explicit authorization, rather than continuing to use the exposed value or leaving rotation for later.

Reason: While inspecting `layah-backend-python`'s deployment-protection settings (`vercel project protection layah-backend-python --json`) to find the bypass secret needed for the fix above, the command's JSON output — which was not anticipated to include the raw secret — printed the actual secret value, and it appeared in visible tool output. Continuing to use a secret known to have been exposed in a transcript, rather than treating it as compromised, would be careless regardless of how mild the actual exposure risk was. The first attempt at rotation was blocked by the permission classifier; rather than working around that block, the situation was explained directly to the user, who then explicitly authorized the rotation.

Alternatives considered: Leaving the exposed secret in place since its blast radius is limited to bypassing Preview deployment protection on one non-production project (rejected — "limited blast radius" is not the same as "acceptable to leave exposed," and rotation was cheap and fast); working around the permission classifier's block without asking (rejected — explicitly against instructions, and the classifier's block was itself a meaningful signal that this action warranted explicit oversight).

Impact: Old secret value revoked and confirmed non-functional (structural check: `protectionBypass` key count returned to 0 before the new one was created — never by printing values). New secret generated and piped directly between `vercel` CLI invocations via shell command substitution, so its value was never displayed, and its correctness was confirmed indirectly by successful routed requests rather than by reading it back (Vercel deliberately excludes sensitive-marked values from `vercel env pull`, by design). `git status` was re-checked after every step; nothing landed in a repository file.

Status: Implemented.
