# Staging Auth Foundation

Date: 2026-09-04

Checkpoint: 29

Status: `STAGING_AUTH_FOUNDATION_MANUAL_PROVISIONING_REQUIRED`

## Objective

Establish a safe, positively classified non-production hosted Supabase
environment so the Wave 1 routes can be proven end to end through a real
frontend Preview, a real standalone backend Preview, and real hosted Supabase
Auth and RLS.

## Environment Discovery

Sources inspected: monorepo `.env.local` and `.env.example`, standalone backend
`.env.example`, `.env.integration.example`, and `.env.local`, both
`supabase/config.toml` files, both GitHub Actions workflows, `.vercel` link
files, the migration audit documents, and the live Vercel environment variable
listings for both projects. Only variable names and hostnames were read. No
key, token, or password value was printed.

### Hosted Supabase Projects Discovered

Exactly one.

| Project reference | Classification | Evidence |
| --- | --- | --- |
| `jbwevzvtloahjoamwnjt` | `PRODUCTION` | It is the `NEXT_PUBLIC_SUPABASE_URL` value in the monorepo `.env.local`, and `NEXT_PUBLIC_SUPABASE_URL` is bound to the **Production** environment of Vercel project `project-scquo`, whose production URL is `https://www.layah.in`. |

This upgrades the long-standing `UNKNOWN` classification from Checkpoints 9-28
to a positive `PRODUCTION` classification. The evidence is deployment binding,
not the project name. The practical effect is stronger safety, not new access:
the project is now provably the live database and is denied by default in the
integration guard.

A second, related finding: `project-scquo` binds the same
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to **Preview**
as well as Production. Any ordinary frontend Preview therefore authenticates
its users against the production Supabase project. That is why the staging
proof requires deployment-scoped frontend Supabase overrides, and why a
frontend Preview must never be pointed at a staging backend while still
issuing production tokens.

### Projects Classified TEST or STAGING

None. No hosted test or staging Supabase project exists in any repository,
deployment configuration, Vercel environment, CI configuration, or document.

### Mutation Record

- Production Supabase projects mutated: none.
- `UNKNOWN` Supabase projects mutated: none.
- Hosted Supabase projects contacted at all: none.
- Production Vercel environment variables changed: none.
- Production routing changed: none.

## Provisioning Attempt

Creating the staging project was attempted through official tooling only, and
is blocked by an account action a human must take.

| Path | Result |
| --- | --- |
| Supabase CLI (`npx supabase projects list`, `orgs list`) | Refused: no access token. `supabase login` is a browser OAuth flow and `SUPABASE_ACCESS_TOKEN` is not set. Version `2.116.0` is available as a project dev dependency. |
| Vercel Marketplace (`vercel integration discover supabase`) | Supabase is offered as a marketplace product, but no marketplace installation exists on the team, and `vercel integration accept-terms` is documented as requiring an interactive terminal and human confirmation. It would also create a billed resource on the owning team. |
| Unofficial automation | Not attempted. Out of policy. |

The Vercel CLI is authenticated as `yusufbasheer-cpu` on team `teacher-app`
and can read both projects, so the blocker is specific to Supabase project
creation, not to deployment tooling generally.

Nothing was fabricated. No staging project was created, and no step of this
checkpoint claims a hosted result it did not obtain.

## What Was Delivered Instead

Everything that does not depend on the missing project was completed, so that
provisioning becomes the only remaining step.

### Environment Classification Guard

The standalone backend's integration harness now resolves its target through
`tests/integration/environment_guard.py`, which enforces explicit
classification rather than inference.

It closes a real hole. The previous guard accepted any URL that did not
contain `prod`, `production`, or `live` as long as the caller labelled the run
`staging`. A Supabase project reference is a random string containing none of
those words, so the production URL would have passed and the suite would have
created users and rows in the live database.

Hosted runs are now refused unless all of the following hold:

- `RUN_STAGING_INTEGRATION=1` is set, so no default command reaches a hosted
  project;
- the URL is a real `https://<ref>.supabase.co` address rather than a local
  one;
- `SUPABASE_INTEGRATION_PROJECT_REF` is set and equals the reference in the
  URL;
- that reference is not on the denylist, which contains the production
  project by default;
- `SUPABASE_INTEGRATION_CLASSIFICATION` is `TEST` or `STAGING` and matches the
  environment label.

Opt-out and unsafe-target are separated deliberately. Not opting in skips.
Opting in with an unprovable target raises, so a misconfiguration fails loudly
instead of quietly passing.

### Harness Modes

| Mode | Command | Requirements |
| --- | --- | --- |
| `LOCAL_DISPOSABLE` | `npm run test:rls` | Local Supabase running. Unchanged and still the default. |
| `STAGING` / `TEST` | `npm run test:rls` with the staging variables | All guard conditions above. |

### Documentation

- `layah-backend-python/docs/STAGING_SUPABASE.md` records the classification
  table, the evidence, the exact manual provisioning steps, both run modes,
  the synthetic-user rules, and the fixture-versus-application authority
  boundary.
- `layah-backend-python/.env.staging.example` records variable names only.
- `layah-backend-python/README.md` links both.

No credential, key, password, or token appears in any committed file.

## Wave 1 Remote Auth Matrix

Not run. Every row below depends on the hosted staging project.

| Proof | Status |
| --- | --- |
| Synthetic User A authenticates against hosted staging Supabase | `BLOCKED_NO_STAGING_PROJECT` |
| Frontend Preview forwards User A bearer | `BLOCKED_NO_STAGING_PROJECT` |
| Backend Preview validates User A through hosted Auth | `BLOCKED_NO_STAGING_PROJECT` |
| Backend uses anon key plus caller bearer for PostgREST | `LOCAL_VERIFIED_REMOTE_BLOCKED` |
| Hosted RLS evaluates the caller | `LOCAL_VERIFIED_REMOTE_BLOCKED` |
| User A reads own data | `LOCAL_VERIFIED_REMOTE_BLOCKED` |
| User B blocked from User A data | `LOCAL_VERIFIED_REMOTE_BLOCKED` |
| Body/query `user_id` cannot impersonate | `LOCAL_VERIFIED_REMOTE_BLOCKED` |
| Cookies not forwarded | `REMOTE_VERIFIED` (Checkpoint 28) |
| Production Supabase never mutated | `VERIFIED` |
| Production frontend routing unchanged | `VERIFIED` |
| Preview route flags roll back | `REMOTE_VERIFIED` (Checkpoint 28) |

## Per-Route Status

Unchanged from Checkpoint 28. No route advanced, and none regressed.

| Operation | Python parity | Local auth/RLS | Remote auth | Production |
| --- | --- | --- | --- | --- |
| `GET /api/user-usage` | `PYTHON_PARITY_COMPLETE` | `LOCAL_AUTH_VERIFIED` | `REMOTE_AUTH_BLOCKED_NO_STAGING_DB` | `PRODUCTION_NOT_CUT_OVER` |
| `GET /api/account/export` | `PYTHON_PARITY_COMPLETE` | `LOCAL_AUTH_VERIFIED` | `REMOTE_AUTH_BLOCKED_NO_STAGING_DB` | `PRODUCTION_NOT_CUT_OVER` |
| `POST /api/lesson-plan/save` | `PYTHON_PARITY_COMPLETE` | `LOCAL_AUTH_VERIFIED` | `REMOTE_AUTH_BLOCKED_NO_STAGING_DB` | `PRODUCTION_NOT_CUT_OVER` |

## Cutover Readiness

`NOT_READY_FOR_PRODUCTION_CUTOVER_CHECKPOINT`.

No route can be classified `REMOTE_AUTH_PREVIEW_VERIFIED`, because no hosted
authentication proof was possible. The blocker is infrastructure access, not
parity, contract, routing, or security design. Nothing in the code prevents
the proof from running the moment a classified staging project exists.

## Exact Remaining Human Action

One person with Supabase organization access performs the following once.

1. Create a Supabase project named `layah-staging` in the Layah organization.
   Smallest available tier. Region closest to the existing production
   workload. Do not touch production.
2. From a checkout of `layah-backend-python`, apply the migrations:
   `npx supabase link --project-ref <staging-ref>` then `npx supabase db push`.
   Migrations are the only schema source. Do not dump or clone production
   schema or data.
3. Provide the staging project reference, URL, anon key, and service-role key
   through a secure channel, never in the repository or in chat history that
   gets committed.

After that, the remaining work is scripted and needs no further account
actions: run the staging integration suite, set Preview-scoped Supabase
variables on the backend Vercel project, set Preview-scoped Supabase and
routing variables on a dedicated frontend Preview, run the three route proofs
and the cross-user proof, then roll every flag back.

## Persistence Decision

The staging project, once created, should persist. It is the prerequisite for
future backend route waves, billing migration tests, admin migration tests, AI
orchestration testing, and pre-production regression. It must hold synthetic
data only and must never be seeded from production.

## Known Residual

The transitional monorepo copy at `backend-python/tests/integration/` still
contains the original, unsound guard. It was deliberately not patched, because
the repository split rule is that backend behaviour is implemented and
maintained only in the standalone repository and must not be copied back.

The risk is unchanged from before this checkpoint rather than newly
introduced, and it requires someone to deliberately set the mutation opt-in
flags and paste the production URL. It should be closed by deleting the
transitional backend copy once Wave 1 cuts over, which is the existing plan
in `BACKEND_REPOSITORY_EXTRACTION.md`. Until then, run the RLS harness from
the standalone repository only.

## Checkpoint 29B Attempt

Date: 2026-09-04

Status: `STAGING_AUTH_FOUNDATION_BLOCKED`

Checkpoint 29B resumed on the understanding that the manual provisioning action
was complete and a project named `layah-staging` now exists.

The project may well exist in the Supabase dashboard, but nothing identifying
it reached the working environment. Every channel was checked:

| Channel | Result |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` in environment | absent |
| Supabase CLI login state | not logged in; `projects list` refused |
| `supabase/.temp/project-ref` link state | absent, not linked |
| Local env files in either repository | only `.example` templates |
| `teacher-app/layah-backend-python` Vercel env | still zero variables |
| `teacher-app/project-scquo` Vercel env | unchanged; newest entry 26 days old |
| Untracked files, scratchpad, memory | nothing |

A search for any `*.supabase.co` host reachable from this machine returns
exactly one: the production project.

Without the project reference, the URL, and the keys, none of Steps 2 through
20 can execute. Step 2 requires verifying the actual reference and proving it
differs from `jbwevzvtloahjoamwnjt` before any hosted mutation. Guessing or
inferring a reference is precisely the failure mode these safety rules exist to
prevent, so nothing hosted was attempted: no link, no migration push, no
synthetic user, no hosted request.

### What Was Completed Instead

The one tooling gap that would have blocked Step 13 even with credentials in
hand is now closed. The integration suite could only ever drive the FastAPI app
in process, so it had no way to exercise a deployed Preview over HTTP.

Setting `INTEGRATION_APP_BASE_URL` now points the identical assertions at a
deployed target: a standalone backend Preview for the direct proof, or a
frontend Preview for the routed proof. The URL must be https, and production
application hosts are refused outright, because these tests drive routes that
write. The Supabase guard still applies, so the tokens involved can only be
staging tokens.

Backend verification after the change: `58 passed, 2 skipped`, ruff clean, and
the local disposable authenticated RLS suite still passes against a freshly
reset database.

### Exact Remaining Blocker

Supply, through a secure channel, the staging project reference, URL, anon key,
and service-role key. A `SUPABASE_ACCESS_TOKEN` or a completed
`npx supabase login` would work equally well, since the reference and the link
step could then be resolved directly.

No route status changed. All three Wave 1 operations remain
`REMOTE_AUTH_BLOCKED_NO_STAGING_DB`, and production remains untouched.

## Checkpoint 29D Result

Date: 2026-09-04

Status: `STAGING_AUTH_FOUNDATION_PARTIAL`

Supabase CLI access now works, so the blocker recorded in 29B and 29C is gone.

### Staging Established

| Item | Value |
| --- | --- |
| Staging reference | `esqnyktumxscyvznftlc` |
| Staging name | `layah-staging` |
| Region | `ap-northeast-2` |
| Created | 2026-09-04 |
| Production reference | `jbwevzvtloahjoamwnjt`, region `ap-northeast-1`, created 2026-05-09 |
| Organization | shared, but separate projects |

Classification `STAGING` rests on evidence, not the name: a distinct project
reference, creation dated to this migration, no production domain binding, a
schema built solely from the backend repository's migrations, and synthetic
data only. Production was never linked, pushed to, read for cloning, or
mutated.

`supabase db push` applied all 43 migrations to the empty project with no
failures, so no reconciliation migration was needed. Wave 1 schema and RLS were
then verified directly: `lesson_plans` and `saved_lessons` return an empty set
to an anon caller, `user_usage` is denied at the grant level per its lockdown
migration, and `ensure_user_usage` exists and refuses unauthenticated callers.

### Hosted And Deployed Backend Proof

The guarded integration suite ran twice against hosted staging: once with the
app in process, then again with `INTEGRATION_APP_BASE_URL` pointed at the
deployed backend Preview. Both passed. Backend Preview logs show the
deployment itself handling the requests, with a 201 insert, a 200 update, and
401s for missing and invalid bearers.

| Item | Value |
| --- | --- |
| Backend SHA deployed | `0d33543` |
| Deployment | `dpl_CFtmy6R1uS9btNAVc7nxfAN9SGCq` |
| Preview URL | `https://layah-backend-python-4k1nxg06c-teacher-app.vercel.app` |
| `/health`, `/ready`, `/openapi.json` | all 200, all three routes present |
| Preview-scoped Supabase variables | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |

Application requests use the anon key plus the caller's own bearer. The
service-role key is confined to test fixture setup and assertions, is not set
on the deployed backend at all, and never reaches the frontend.

### Routed Proof, With A Deviation

The frontend Preview deployment could not be created: this session's
permission policy refused every `vercel deploy` of `project-scquo`. That is a
local policy limit, not an infrastructure or configuration problem.

The routing seam was therefore proven the way Checkpoint 20 did it, by running
Next locally against the same staging Supabase project with
`PYTHON_BACKEND_URL` pointed at the deployed backend Preview. One route flag
was enabled at a time.

| Run | Flag | Result |
| --- | --- | --- |
| 1 | `BACKEND_ROUTE_USER_USAGE=python` | routed, 200, caller's own free-tier snapshot, query `user_id` ignored, 401 on missing and invalid bearer |
| 2 | `BACKEND_ROUTE_ACCOUNT_EXPORT=python` | routed, 200, attachment header preserved, caller's own account only |
| 3 | `BACKEND_ROUTE_LESSON_PLAN_SAVE=python` | routed, 201 insert, 200 own update, spoofed `user_id` stored as User A, User B could not modify User A's row |
| 4 | none | zero Python routing decisions, all three served by Next |

Run 3 was 13 checks out of 13, including the cross-user denial through the
deployed chain: User B's overwrite attempt returned the existing zero-row
semantics and the stored row was unchanged in owner and content.

Because these runs used a local Next process rather than a deployed frontend,
the routes are **not** classified `REMOTE_AUTH_PREVIEW_VERIFIED`. What is now
proven is every layer below that: hosted staging Auth and RLS, a real deployed
FastAPI Preview, and the routing seam with one flag at a time and a clean
rollback.

### Finding: Next Lesson Save Requires A Cookie Session

With lesson save on the Next handler, a bearer-only client receives
`500` and the server logs `Auth session missing!`. The Next implementation
reads the Supabase session from cookies, while the Python implementation
derives identity from the bearer. This is pre-existing behaviour, it was not
changed, and it does not affect browser clients, which always send cookies. It
does mean a bearer-only caller can drive that route only when it is routed to
Python.

### Cleanup

- No frontend route flag persists anywhere. All three were deployment-scoped
  to local runs that have ended, and `project-scquo` has no `BACKEND_ROUTE_*`
  or `PYTHON_BACKEND_URL` variable at project level.
- The automation bypass secret created on the backend project by the Preview
  deploy was removed. The project is back to zero bypass entries with SSO
  protection intact.
- `project-scquo` environment variables are unchanged, the newest being 102
  days old.
- Backend Preview Supabase variables were kept deliberately, since they are
  Preview-scoped staging configuration and the next checkpoint needs them.

### Per-Route Status

| Operation | Python parity | Local auth/RLS | Hosted staging auth/RLS | Deployed backend | Routed seam | Production |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/user-usage` | `PYTHON_PARITY_COMPLETE` | `LOCAL_AUTH_VERIFIED` | `STAGING_AUTH_VERIFIED` | `DEPLOYED_BACKEND_AUTH_VERIFIED` | `ROUTED_LOCAL_NEXT_VERIFIED` | `PRODUCTION_NOT_CUT_OVER` |
| `GET /api/account/export` | `PYTHON_PARITY_COMPLETE` | `LOCAL_AUTH_VERIFIED` | `STAGING_AUTH_VERIFIED` | `DEPLOYED_BACKEND_AUTH_VERIFIED` | `ROUTED_LOCAL_NEXT_VERIFIED` | `PRODUCTION_NOT_CUT_OVER` |
| `POST /api/lesson-plan/save` | `PYTHON_PARITY_COMPLETE` | `LOCAL_AUTH_VERIFIED` | `STAGING_AUTH_VERIFIED` | `DEPLOYED_BACKEND_AUTH_VERIFIED` | `ROUTED_LOCAL_NEXT_VERIFIED` | `PRODUCTION_NOT_CUT_OVER` |

### Remaining Blocker

One deployed frontend Preview of `project-scquo`, carrying deployment-scoped
staging Supabase variables, `PYTHON_BACKEND_URL`, a backend automation bypass
secret, and one route flag at a time. Everything needed for it is already
written and proven; only the deploy itself was refused here.

## Checkpoint 29E Result

Date: 2026-09-04

Status: `STAGING_AUTH_FOUNDATION_VERIFIED`

The deployment blocker from 29D is gone. Genuine frontend Preview deployments
of `project-scquo` were created, and the missing evidence now exists.

### Deployments

All frontend variables were deployment-scoped. No project-level Preview or
Production variable was created, changed, or removed.

| Purpose | Preview URL | Deployment |
| --- | --- | --- |
| Baseline, no route flag | `https://project-scquo-f19ulm4aa-teacher-app.vercel.app` | `dpl_8wVA9KvCkETSqKor7zxeZX7K9Myf` |
| `BACKEND_ROUTE_USER_USAGE=python` | `https://project-scquo-efka6e4v6-teacher-app.vercel.app` | `dpl_2k43bxKkf3xaC9a9ZjAT4oXu3zs8` |
| `BACKEND_ROUTE_ACCOUNT_EXPORT=python` | `https://project-scquo-jg78zyzu9-teacher-app.vercel.app` | `dpl_6WXS4sGo4n8gMRuw5bYfHWSaY5EX` |
| `BACKEND_ROUTE_LESSON_PLAN_SAVE=python` | `https://project-scquo-r6ovxrg7s-teacher-app.vercel.app` | `dpl_8EWs64MZhtPNjvAdLgt4sMWCLWUi` |

Backend Preview reused unchanged: `dpl_CFtmy6R1uS9btNAVc7nxfAN9SGCq`, SHA
`0d33543`, healthy on `/health` and `/ready` before use.

### Auth Issuer Consistency

The baseline Preview accepted a token issued by staging Supabase and returned
the caller's own data. A Production-configured frontend could not validate a
staging token, so this establishes that the frontend Preview, the backend
Preview, and the database are all `esqnyktumxscyvznftlc`.

### Route Proofs Through The Deployed Chain

Each run used synthetic staging User A and User B, one route flag at a time.

`GET /api/user-usage`: 200 with the caller's own free-tier snapshot, a query
`user_id` naming User B ignored, 401 for missing and invalid bearers. Backend
Preview logs show the deployment handling those requests.

`GET /api/account/export`: 200, `Content-Disposition: attachment;
filename="layah-my-data.json"` preserved, payload containing only User A's
account. Backend Preview logs show a 200 and the two 401s.

`POST /api/lesson-plan/save`: 13 checks of 13 passed. Insert returned 201 with
the row owned by User A, the caller's own update returned 200, a spoofed body
`user_id` naming User B still stored User A as owner, and User B's attempt to
overwrite User A's row left the stored owner and content unchanged while
preserving the existing zero-row response semantics.

That last item is the remote cross-user proof, and it ran through the deployed
frontend Preview, the deployed backend Preview, and staging RLS. Live streamed
backend logs captured it as it happened, at 15:34:38 and 15:34:42, with fresh
request identifiers and statuses 201 and 200.

There is also an independent control for lesson-save routing. The Next handler
cannot serve a bearer-only client at all, returning 500 with `Auth session
missing!`, which is exactly what the baseline Preview did. The routed Preview
returned 201 for the same request. Only the Python backend can produce that
result.

### Rollback

The final no-flag Preview served all three routes from Next handlers, and
streamed backend logs recorded zero requests on any Wave 1 path during that
run. No Python route flag persists: every one was deployment-scoped to a
Preview that is no longer the validation target, and `project-scquo` has no
`BACKEND_ROUTE_*` or `PYTHON_BACKEND_URL` variable at project level.

### Cleanup And Production Safety

The temporary automation bypass secrets on the backend project were removed,
leaving zero entries with SSO protection intact. `project-scquo` environment
variables are unchanged, the newest being 102 days old, and its production URL
remains `https://www.layah.in`. Production Supabase `jbwevzvtloahjoamwnjt` was
never linked, pushed to, read for cloning, or mutated. No production user or
data was involved, and no deployment was promoted.

Staging Supabase variables were never persisted at project scope, so ordinary
Previews continue to behave exactly as before. Only the four dedicated
validation deployments carried staging configuration.

### Known Transport Difference

The Next lesson-save handler derives identity from the browser cookie session.
The Python handler derives it from the `Authorization` bearer. Browser clients
send cookies and are unaffected, so this is not a regression, but a bearer-only
caller can drive that route only when it is routed to Python. Nothing was
changed here.

### Final Per-Route Status

| Operation | Status |
| --- | --- |
| `GET /api/user-usage` | `PYTHON_PARITY_COMPLETE`, `LOCAL_AUTH_VERIFIED`, `HOSTED_STAGING_AUTH_VERIFIED`, `DEPLOYED_BACKEND_VERIFIED`, `REMOTE_AUTH_PREVIEW_VERIFIED`, `ROLLED_BACK_TO_NEXT`, `PRODUCTION_NOT_CUT_OVER` |
| `GET /api/account/export` | `PYTHON_PARITY_COMPLETE`, `LOCAL_AUTH_VERIFIED`, `HOSTED_STAGING_AUTH_VERIFIED`, `DEPLOYED_BACKEND_VERIFIED`, `REMOTE_AUTH_PREVIEW_VERIFIED`, `ROLLED_BACK_TO_NEXT`, `PRODUCTION_NOT_CUT_OVER` |
| `POST /api/lesson-plan/save` | `PYTHON_PARITY_COMPLETE`, `LOCAL_AUTH_VERIFIED`, `HOSTED_STAGING_AUTH_VERIFIED`, `DEPLOYED_BACKEND_VERIFIED`, `REMOTE_AUTH_PREVIEW_VERIFIED`, `ROLLED_BACK_TO_NEXT`, `PRODUCTION_NOT_CUT_OVER` |

Wave 1 is `READY_FOR_PRODUCTION_CUTOVER_CHECKPOINT`. The cutover itself was not
performed. Next handlers and the transitional monorepo backend copy remain in
place.
