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
