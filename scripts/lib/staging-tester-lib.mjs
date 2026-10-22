// Pure/injectable helpers for scripts/gamma-create-staging-tester.mjs. No process.exit, no console output of secrets.
// Error messages NEVER include CLI stdout (it can contain API keys) or request bodies (they contain the password).

export class StagingTesterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StagingTesterError";
    this.code = code;
  }
}
const fail = (code, message) => { throw new StagingTesterError(code, message); };

export const STAGING_REF = "esqnyktumxscyvznftlc";
export const PROD_REF = "jbwevzvtloahjoamwnjt";

/** First JSON value in `text` (the CLI may print banners such as "Initialising login role..." first). */
export function parseCliJson(text) {
  const s = String(text ?? "");
  const start = s.search(/[{[]/);
  if (start < 0) fail("cli-output-not-json", "CLI printed no JSON.");
  try {
    return JSON.parse(s.slice(start));
  } catch {
    fail("cli-output-not-json", "CLI output was not valid JSON.");
  }
}

/**
 * Rows of a `supabase db query -o json` result. The CLI's shape DEPENDS ON THE CALLER:
 *   human terminal      -> [ {...}, ... ]
 *   AI-agent runtime    -> { boundary, rows: [ {...} ], warning }
 * Anything else (including an error object) is an explicit error, never `undefined`.
 */
export function extractRows(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.rows)) return parsed.rows;
    const err = parsed.error ?? (parsed._tag === "Error" ? parsed : null);
    if (err) {
      const msg = typeof err === "string" ? err : typeof err.message === "string" ? err.message : "unknown error";
      fail("db-query-failed", `The database query failed: ${msg.slice(0, 200)}`);
    }
    fail("db-unexpected-shape", `Unexpected query result shape (keys: ${Object.keys(parsed).slice(0, 6).join(", ") || "none"}).`);
  }
  fail("db-unexpected-shape", `Unexpected query result type (${parsed === null ? "null" : typeof parsed}).`);
}

/** Runs the CLI and returns parsed JSON. Checks the exit status. `run(args)` => { status, stdout, stderr }. */
export function runCliJson(run, args, { what = "supabase CLI call" } = {}) {
  const r = run(args);
  if (r.status !== 0) {
    const line = String(r.stderr ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "no error output";
    fail("cli-failed", `${what} failed (exit ${r.status}): ${line.slice(0, 200)}`);
  }
  return parseCliJson(r.stdout);
}

/** The project must be exactly the healthy, correctly named staging project. */
export function assertStagingProject(projectsResult, ref = STAGING_REF) {
  if (ref === PROD_REF) fail("production-refused", "That is the PRODUCTION project.");
  const projects = projectsResult?.projects ?? (Array.isArray(projectsResult) ? projectsResult : null);
  if (!Array.isArray(projects)) fail("projects-unexpected-shape", "`supabase projects list` returned an unexpected shape.");
  const p = projects.find((x) => x?.ref === ref);
  if (!p) fail("project-not-found", `Project ${ref} was not found.`);
  if (p.name !== "layah-staging") fail("project-wrong-name", `Project ${ref} is named "${p.name}", expected "layah-staging".`);
  if (p.status !== "ACTIVE_HEALTHY") fail("project-unhealthy", `Staging project status is ${p.status}.`);
  return p;
}

/** service_role key from `supabase projects api-keys -o json`, proven to belong to the staging project via its JWT `ref` claim. */
export function serviceKeyFromApiKeys(parsed, ref = STAGING_REF) {
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.keys) ? parsed.keys : null;
  if (!list) fail("api-keys-unexpected-shape", "`supabase projects api-keys` returned an unexpected shape.");
  const key = list.find((k) => k?.name === "service_role")?.api_key;
  if (typeof key !== "string" || !key) fail("service-key-missing", "No service_role key was returned for the staging project.");
  let claim;
  try {
    claim = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString()).ref;
  } catch {
    /* falls through */
  }
  if (claim === PROD_REF) fail("service-key-is-production", "The service-role key belongs to PRODUCTION. Refusing.");
  if (claim !== ref) fail("service-key-not-staging", "The service-role key is not verifiably the staging project's.");
  return key;
}

const adminHeaders = (key) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });
const apiError = async (res, what) => {
  const body = await res.json().catch(() => ({}));
  const msg = String(body?.msg ?? body?.message ?? body?.error_description ?? body?.error ?? "").slice(0, 160);
  fail(res.status === 401 || res.status === 403 ? "admin-api-unauthorised" : "admin-api-failed", `${what} failed: HTTP ${res.status}${msg ? ` ${msg}` : ""}`);
};

/** All users via the Auth Admin API (supported, no SQL). Paginates; validates the response shape. */
export async function adminListUsers(doFetch, baseUrl, key, { perPage = 200, maxPages = 50 } = {}) {
  const users = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await doFetch(`${baseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, { headers: adminHeaders(key), signal: AbortSignal.timeout(30_000) });
    if (!res.ok) await apiError(res, "Listing staging users");
    const body = await res.json().catch(() => null);
    const batch = Array.isArray(body) ? body : Array.isArray(body?.users) ? body.users : null;
    if (!batch) fail("admin-api-unexpected-shape", "The Admin API returned an unexpected users response.");
    users.push(...batch);
    if (batch.length < perPage) return users;
  }
  fail("admin-api-too-many-pages", "Refusing to page through an unexpectedly large user list.");
}

export function findUserByEmail(users, email) {
  const e = String(email).trim().toLowerCase();
  return users.find((u) => typeof u?.email === "string" && u.email.trim().toLowerCase() === e) ?? null;
}

/** Creates a pre-confirmed user. The password only ever travels in the request body; it is never echoed in an error. */
export async function adminCreateConfirmedUser(doFetch, baseUrl, key, email, password) {
  const res = await doFetch(`${baseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders(key),
    body: JSON.stringify({ email, password, email_confirm: true }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    if (body?.error_code === "email_exists" || /already (been )?registered|already exists/i.test(String(body?.msg ?? body?.message ?? ""))) {
      fail("user-exists", "An account with this email already exists in staging.");
    }
    fail("admin-api-failed", `Creating the user failed: HTTP 422 ${String(body?.msg ?? body?.message ?? "").slice(0, 160)}`);
  }
  if (!res.ok) await apiError(res, "Creating the user");
  const body = await res.json().catch(() => null);
  if (!body || typeof body.id !== "string") fail("admin-api-unexpected-shape", "The Admin API did not return the created user.");
  return { id: body.id, confirmed: Boolean(body.email_confirmed_at) };
}
