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

## 2026-09-01 (Checkpoint 21)

Decision: Fix `project-scquo`'s Root Directory setting in two places — the server-side project setting (via `vercel project update --auto-detect root-directory`) and, separately, a local gitignored `.vercel/repo.json` link-file override — rather than working around the blocker again.

Reason: This checkpoint explicitly authorized fixing the frontend's deployment configuration, unlike Checkpoints 19–20 where `project-scquo` was strictly off-limits. Repository evidence (`package.json`, `next.config.ts`, `vercel.json` all at repo root) made the correct value unambiguous: empty/unset, not the stored literal `.`. The server-side fix alone did not resolve the deploy failure — a retry after that change reproduced the identical error, revealing that the local `.vercel/repo.json` link file's own `directory` field (also `.`) independently feeds into the deploy API's `rootDirectory` request payload. Testing an empty string there produced a different, more specific error (`should NOT be shorter than 1 characters`), which precisely identified the required fix: omit the field entirely rather than send any string value.

Alternatives considered: Guessing a specific path string for either setting (rejected — `--auto-detect` is the smallest, most correct mechanism, and guessing risks introducing a different wrong value); fixing only one of the two locations (rejected — empirically insufficient, confirmed by the repeated failure after the server-side-only fix); leaving the local `.vercel/repo.json` fix in place only temporarily (rejected — it's a genuine bug fix to local, non-shared, non-repository machine state, not test configuration, so there is nothing to "roll back").

Impact: `vercel deploy` (Preview, non-git-integration) now succeeds reliably against `project-scquo` — proven by 6 successful Preview deployments across this checkpoint. `project-scquo`'s identity (project ID), framework preset, and production domain (`layah.in`) confirmed unchanged before and after. No repository file was touched (`.vercel/` is gitignored). This unblocked full real Preview-to-Preview validation for both pilot endpoints — see the Checkpoint 21 addendum in `REMOTE_ROUTING_VALIDATION.md`.

Status: Implemented.

## 2026-09-01 (Checkpoint 21)

Decision: Declare `PILOT_ENDPOINT_MIGRATION_PHASE = COMPLETE` and shift the migration unit to `NEXT MIGRATION MODE = BATCH / SUBSYSTEM WAVES`, per the user's explicit direction.

Reason: Both pilot endpoints (`geo`, `verify-captcha`) are now validated at every layer this migration cares about — contract parity, Python implementation, disabled-by-default routing, real remote deployment, real Preview-to-Preview routing (including verify-captcha's actual provider branch), security isolation, observability, and configuration-only rollback. Continuing to spend one checkpoint per additional low-risk endpoint would repeat already-proven infrastructure work rather than testing anything new; the architectural question this whole pilot existed to answer is answered.

Alternatives considered: Continuing one-endpoint-per-checkpoint for the remaining low-risk routes (rejected — explicitly against the user's direction, and would not produce meaningfully new evidence); immediately beginning a Production canary (deferred, not rejected — a real option for Checkpoint 22, but a separate decision from closing the pilot phase itself).

Impact: `docs/migration-audit/MIGRATION_MASTER_PLAN.md` now records the pilot-phase closure and the batch/subsystem-wave direction for future migration work. `BACKEND_MIGRATION_MANIFEST.md`, `GEO_PYTHON_CUTOVER.md`, and `VERIFY_CAPTCHA_PYTHON_PARITY_CONTRACT.md` all updated to reflect final validated status. No endpoint was cut over to Production; that remains a distinct, unmade decision.

Status: Implemented.

## 2026-09-01 (Checkpoint 22)

Decision: Classify the first bulk-migration wave as `NO_SAFE_WAVE_1_COHORT` and change no code, rather than lowering the migration-safety bar to produce a batch.

Reason: This checkpoint's mandate was to investigate the full remaining Next API surface (all ~84 operations) using the existing audit plus targeted source spot-checks, and only migrate what investigation actually proved safe — explicitly not to force a batch for its own sake. That investigation found every remaining route requires at least one of: Supabase (read or write), auth/session, an AI provider, billing, admin authorization, export/file complexity, or SMTP. The two already-completed pilots (`geo`, `verify-captcha`) were not a sample of a larger safe category — they were the entire category. In particular, no "authenticated read" route qualified under this checkpoint's own carve-out for that case, because (a) the proven routing seam deliberately never forwards `Authorization`/`Cookie` — extending it to do so would be new, unproven, unreviewed work, not reuse of proven infrastructure — and (b) the database source-of-truth remains `HYBRID_TRANSITION_REQUIRED` project-wide, not just for `lesson_plans`, so treating a different Supabase-backed read as "safe" while that same underlying reproducibility problem blocks `lesson-plan/save` would be an inconsistent, silent lowering of the bar.

Alternatives considered: Migrating an authenticated read endpoint (e.g. `hod/me` or `user_usage`) on the theory that "GET is safe" (rejected — GET-ness doesn't address the Authorization-forwarding or RLS-verification gaps, which are the actual unresolved risks, not the HTTP method); migrating one of `contact`/`feedback`/`waitlist`/`school-register` since they were once labeled low-risk (rejected — Checkpoint 18 already found and documented their real service-role Supabase writes; re-opening that would be inconsistent with a decision already made on stronger evidence); doing partial/exploratory Python implementation work "just in case" (rejected — explicitly against the checkpoint's own instruction not to manufacture work when the evidence doesn't support it).

Impact: `docs/migration-audit/BACKEND_WAVE_1_INVESTIGATION.md` records the full per-route classification and reasoning. `BACKEND_MIGRATION_MANIFEST.md`, `PYTHON_BACKEND_MIGRATION.md`, and `MIGRATION_MASTER_PLAN.md` updated to correct the prior assumption that a "remaining low-risk public endpoints" wave existed — it does not. No application code, tests, or routing configuration changed. The practical implication is that the next real migration unlock is the database source-of-truth track (Track A/C), not further endpoint-by-endpoint or batch migration work under the current constraints.

Status: Implemented (investigation); no migration performed (correctly, per evidence).

## 2026-09-01 (Checkpoint 23)

Decision: Write and statically test a `lesson_plans` baseline reconciliation migration, but do not attempt to apply it (or run any live RLS/auth test) against any database this checkpoint.

Reason: Re-checking the target-investigation evidence from Checkpoints 9–13 found nothing had changed: no Supabase CLI, no Docker (installing it is a heavyweight system-level change outside autonomous scope), and the only hosted Supabase project remains `UNKNOWN` (no repository or environment marker classifies it as local/test/staging). Per this checkpoint's own mandatory stop rule, an `UNKNOWN`/production-only situation means live testing must not be forced. However, `DATABASE_BASELINE_SPEC.md` already contained a `VERIFIED`-confidence exact SQL shape for `lesson_plans` (unlike `saved_lessons`/`school_templates`, which remain `PARTIAL`), so writing that one migration — guarded to be a complete no-op wherever the table already exists — was safe repository work that materially improves reproducibility without touching any live system.

Alternatives considered: Also writing baseline migrations for `saved_lessons`/`school_templates` (rejected — both remain `PARTIAL` confidence; writing SQL from an unverified shape risks encoding a wrong contract, and neither is needed by the one endpoint, `lesson-plan/save`, this checkpoint's foundation targets — "smallest correct reconciliation slice"); attempting to apply the migration to the `.env.local` project anyway since it's "probably fine" (rejected — explicitly the scenario the checkpoint's safety rules forbid); skipping the migration entirely since it can't be tested this checkpoint (rejected — the migration is independently verifiable via a static test proving its SQL matches `schema.sql`'s already-verified contract, so "untested against a live database" does not mean "unverified").

Impact: `supabase/migrations/20260101000000_lesson_plans_baseline_reconciliation.sql` added. `backend-python/tests/test_supabase_schema_contract.py` gained a new static test proving consistency with `schema.sql`. `lesson_plans` reproducibility status moves from `PLANNED_BUT_NOT_EXECUTABLE` to `RECONCILIATION_SQL_WRITTEN_UNTESTED`. No database was mutated.

Status: Implemented.

## 2026-09-01 (Checkpoint 23)

Decision: Document and add regression coverage for the zero-row-update false-positive-success behavior in `lesson-plan/save`, in both Next and Python, without changing either implementation's behavior.

Reason: Investigating this checkpoint's flagged "prior unresolved zero-row update issue" found that Next's existing `saveLessonPlanRecord` (`src/lib/lesson-plan-save.ts`) never inspects PostgREST's affected-row count — a plain SQL `UPDATE` against a filter that matches zero rows (wrong id, or an id owned by another user and blocked by RLS) is not an error, so it returns `204` either way, and the existing code reports `{"action": "updated", ...}` regardless. The Python parity implementation already replicates this exactly (also checks only HTTP status, not row count). This is a genuine, previously-undocumented behavior, but it is *already-matched* parity, not a bug introduced by migration — the checkpoint's own rule is "preserve that semantic in Python... do not improve behavior unless contract documentation explicitly calls for change," and no such call exists.

Alternatives considered: "Fixing" both implementations to detect and report zero-row updates as a 404 or similar (rejected — no contract documentation calls for this change, and doing it silently during a migration checkpoint is exactly the kind of behavior change this migration's rules forbid without an explicit, separate product decision); leaving it undocumented since Python already matches Next (rejected — the checkpoint explicitly asked to "resolve it with evidence" and "add regression coverage," and an undocumented surprising behavior is a liability for whoever touches this code next, migration-related or not).

Impact: `docs/migration-audit/LESSON_PLANS_MUTATION_CONTRACT.md` documents the behavior explicitly. New regression tests added to both `src/lib/lesson-plan-save.test.ts` and `backend-python/tests/test_lesson_plan.py`, both asserting the exact false-positive-success response. No production code changed in either language.

Status: Implemented.

## 2026-09-01 (Checkpoint 23)

Decision: Classify this checkpoint `AUTHENTICATED_DB_FOUNDATION_PARTIAL`, not `AUTHENTICATED_DB_FOUNDATION_VERIFIED` or `AUTHENTICATED_DB_FOUNDATION_EXTERNALLY_BLOCKED`.

Reason: `VERIFIED` requires live RLS cross-user isolation and live authenticated persistence verification, neither of which was possible (no safe target). `EXTERNALLY_BLOCKED` would be accurate only if no safe repository-side progress were possible either — but real, concrete, independently-verifiable progress was made: `lesson_plans` reproducibility, zero-row-update semantics resolved and tested, and confirmation (not new work — the code was already correctly scoped) that the auth/persistence foundation is reusable for a future authenticated endpoint. `PARTIAL` is the label that doesn't overstate unproven live behavior while still crediting real, evidenced work.

Alternatives considered: `VERIFIED` (rejected — would be a fabricated claim; no live database was ever touched); `EXTERNALLY_BLOCKED` (rejected — undersells the reconciliation migration, the zero-row-update resolution, and the confirmed-complete integration harness, all of which are real and independently checkable without a live target).

Impact: `docs/migration-audit/AUTHENTICATED_BACKEND_PATTERN.md` created as the canonical reference for the next authenticated migration wave. Wave 2 readiness: `PARTIALLY` unblocked — the pattern, the reusable code, and (for `lesson_plans` specifically) the schema are ready; a safe execution target and an Authorization-forwarding routing design remain the two concrete external/design prerequisites.

Status: Implemented.

## 2026-09-03 (Checkpoint 24)

Decision: Pin the Supabase CLI as a project dev dependency and classify the authenticated database foundation as externally blocked until Docker Desktop is installed and running.

Reason: The migration branch already contains the authenticated FastAPI pattern, guarded RLS harness, and `lesson_plans` reconciliation migration. `npx supabase --version` now verifies the official CLI path at `2.116.0`, but `docker` is not installed/on PATH and `npx supabase start` fails before any local database can start. On Windows 11 Home x64, the supported Docker path is Docker Desktop, which requires user/GUI/elevation handling and should not be silently installed by the agent.

Alternatives considered: silently running the Docker Desktop installer through winget (rejected because it is a system GUI/admin install for a beginner user); contacting the unknown `.env.local` hosted Supabase project (rejected, still not classified as test/staging); creating a second RLS harness (rejected, existing harness remains the right one).

Impact: `supabase` is available through `npx`, `npm run test:rls` names the existing guarded integration harness, and local workflow docs now tell a beginner to install/open Docker Desktop first. No hosted Supabase project, production route, schema migration, auth logic, billing, AI, or frontend behavior changed.

Status: Implemented repository-side; live RLS verification externally blocked.

## 2026-09-03 (Checkpoint 25)

Decision: Add the missing `saved_lessons` fresh-baseline reconciliation
needed by local reset and classify the authenticated DB foundation as
verified after the existing RLS harness passed against local disposable
Supabase.

Reason: Docker Desktop is now installed and reachable through its WSL2
backend, allowing `npx supabase start` and `npx supabase db reset` to run
locally. The first reset exposed a concrete historical migration gap:
`20260610120000_saved_lessons_learning_objectives.sql` altered
`saved_lessons`, but no earlier migration created the base table.
Creating the minimal existence-guarded baseline lets a fresh local clone
replay the migration chain without touching any hosted database.

Alternatives considered: bypassing unrelated later migrations (rejected
because fresh reset must prove the tracked chain); using the hosted
`.env.local` project (rejected because it remains `UNKNOWN`); broad
database redesign or perfect historical reconstruction (rejected because
the checkpoint only needed the minimal forward reconciliation required
for local reset and authenticated lesson-save proof).

Impact: `npx supabase db reset` and `npm run test:rls` pass locally.
Synthetic User A/B proved Supabase Auth, bearer-token validation,
server-derived identity, anon-key caller-context PostgREST, RLS
isolation, body `user_id` distrust, and missing/invalid auth denial. No
production routes, hosted Supabase data, frontend design, billing, admin,
cron, PPT, or AI behavior changed.

Status: Implemented and verified locally.

## 2026-09-03 (Checkpoint 26)

Decision: Create a sanitized standalone local `layah-backend-python`
repository with one initial commit, rather than copying full monorepo
history without a safe history-filtering tool.

Reason: `git-filter-repo` is not installed and no equivalent safe
history-preserving extraction tool is available in this environment.
Secret safety is mandatory for a physical split, so the extracted repo
starts with a clean standalone commit containing only the backend,
contract fixtures, Supabase local/migration files, and standalone repo
metadata required to validate independently.

Alternatives considered: preserving full history manually (rejected
because it risks copying unrelated history/secrets); deleting the
monorepo backend copy immediately (rejected because fallback is required
until remote and cutover decisions are complete); creating the AI service
repo too (rejected because this checkpoint is backend-only).

Impact: Local repo `C:\Liyaah\layah-backend-python` exists at commit
`735453de6adf2a00b0f90625ff28892f7a28f14f` and passes standalone tests,
Ruff, FastAPI smoke, local Supabase reset, and authenticated RLS
verification from both the repo and a fresh local clone. No production
routing, hosted database, frontend, billing, admin, cron, PPT, Razorpay,
or AI configuration changed. A GitHub remote still needs to be created
or connected.

Status: Implemented locally; remote provisioning required.

## 2026-09-04 (Checkpoint 27)

Decision: Treat `yusufbasheer-cpu/layah-backend-python` as the
standalone backend remote and canonical starting point for new backend
development, while keeping the monorepo backend copy as a transitional
fallback.

Reason: The remote repository now exists, the standalone backend pushed
cleanly without force, remote CI passed on `main`, and a Preview-only
frontend route test proved `project-scquo` can call a backend Preview
deployed from the standalone backend checkout. Rollback was proven with a
second frontend Preview deployed without Python routing env.

Alternatives considered: permanently connecting the existing Vercel
backend project to GitHub in this checkpoint (deferred because it may
alter future Production deployment behavior); cutting Production geo
traffic now (rejected because this checkpoint is Preview-only);
continuing to treat the monorepo backend copy as primary (rejected
because the remote-backed standalone repo is now validated).

Impact: New backend work should happen in
`https://github.com/yusufbasheer-cpu/layah-backend-python`. Production
routing, DNS, hosted Supabase, Razorpay, billing, admin, cron, PPT, and
AI-service ownership remain unchanged. Branch protection still requires
owner/admin action because the authenticated collaborator received
GitHub API `404` when attempting to protect `main`.

Status: Implemented and Preview-verified.

## 2026-09-04 (Checkpoint 28)

Decision: Migrate `GET /api/user-usage` and `GET /api/account/export` into
the standalone backend, add guarded routing for those routes and the existing
`POST /api/lesson-plan/save`, and classify the wave
`BACKEND_WAVE_1_LOCAL_VERIFIED_REMOTE_AUTH_BLOCKED`.

Reason: These are the smallest current operations that use caller-context
Supabase access without service-role application authority. Local disposable
Supabase and CI can prove genuine Auth/RLS behavior. The hosted backend Preview
has no Supabase configuration, and no TEST/STAGING project is documented, so a
real remote authenticated DB test would require unsafe assumptions.

Alternatives considered: moving `hod/me` or school-admin identity reads
(rejected because current handlers use service-role access); school templates
(rejected because the table is not migration-reproducible); school enrollment
(rejected because it is a multi-table privileged mutation); configuring the
UNKNOWN hosted Supabase project on the backend Preview (rejected because its
environment classification is not safe); cutting Production traffic (outside
this checkpoint and not authorized).

Impact: standalone backend SHA
`68d7b70f1c660e5e101b999dd2a795bb15faaea4` passed local and remote CI.
Monorepo routing commit `905d6bc8c96953150b463f3fcdf98b7fddc23c5b`
adds three independent, disabled-by-default flags. Each route reached FastAPI
through a real frontend Preview using intentional bearer forwarding and no
cookie forwarding; final rollback returned all routes to Next. No persistent
routing env, bypass secret, Production route, hosted DB mutation, billing,
admin, cron, PPT, or AI change remains.

Status: Implemented; safe hosted auth foundation required before Production
cutover consideration.

## Checkpoint 29 — Staging Auth Foundation

Decision: classify the single discovered hosted Supabase project as
`PRODUCTION` on deployment evidence, refuse to use it, and make the
integration harness enforce classification explicitly instead of inferring it.

Reasoning: the hosted project could not stay `UNKNOWN` once the Vercel
environment listing showed its URL bound to the Production environment of the
project serving `https://www.layah.in`. That evidence closes the
classification and permanently forbids the target. Separately, the previous
harness guard was found to be unsound: it rejected URLs containing `prod`,
`production`, or `live`, but a Supabase project reference contains none of
those, so labelling a run `staging` and pasting the production URL would have
created synthetic users and rows in the live database.

Alternatives considered: creating a Supabase project through the CLI
(rejected, no access token and `supabase login` is a browser OAuth flow);
provisioning Supabase through the Vercel Marketplace (rejected, `integration
accept-terms` requires an interactive terminal and human confirmation, and it
creates a billed resource on the owning team, which is an owner decision);
reusing the production project with careful test hygiene (rejected outright);
treating a project as staging because of its name (rejected, that is the
failure mode this checkpoint exists to prevent).

Impact: standalone backend SHA `e95bb0ab4365680f02053b3d03eab87e5ca57eb2`
adds the shared classification guard, a hosted staging mode gated behind
`RUN_STAGING_INTEGRATION=1`, fourteen guard unit tests, `.env.staging.example`,
and `docs/STAGING_SUPABASE.md`. Local disposable behaviour is unchanged and
still passes. No hosted Supabase project was created, contacted, or mutated,
and no Vercel environment variable, deployment, or route flag was changed.

Status: Blocked on one manual action. A person with Supabase organization
access must create `layah-staging` and apply the backend migrations to it.
Every subsequent step is scripted.
