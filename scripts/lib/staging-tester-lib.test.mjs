import { describe, expect, it, vi } from "vitest";
import {
  PROD_REF, STAGING_REF, StagingTesterError, adminCreateConfirmedUser, adminListUsers, assertStagingProject,
  extractRows, findUserByEmail, parseCliJson, runCliJson, serviceKeyFromApiKeys,
} from "./staging-tester-lib.mjs";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (ref) => `${b64({ alg: "HS256" })}.${b64({ ref, role: "service_role" })}.sig`;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const code = (fn) => { try { fn(); } catch (e) { return e instanceof StagingTesterError ? e.code : `other:${e?.message}`; } return "no-error"; };
const codeAsync = async (p) => { try { await p; } catch (e) { return e instanceof StagingTesterError ? e.code : `other:${e?.message}`; } return "no-error"; };

describe("extractRows: the CLI output shape depends on who runs it (the reported TypeError)", () => {
  it("human terminal: bare array", () => {
    expect(extractRows([{ n: 0 }])).toEqual([{ n: 0 }]);
  });
  it("AI-agent runtime: { boundary, rows, warning }", () => {
    expect(extractRows({ boundary: "abc", rows: [{ n: 3 }], warning: "untrusted data" })).toEqual([{ n: 3 }]);
  });
  it("empty results are valid and stay empty arrays (never undefined)", () => {
    expect(extractRows([])).toEqual([]);
    expect(extractRows({ boundary: "abc", rows: [], warning: "w" })).toEqual([]);
  });
  it("an error object is an explicit db-query-failed error with the message, not a TypeError", () => {
    expect(code(() => extractRows({ _tag: "Error", error: { code: "X", message: "permission denied for table users" } }))).toBe("db-query-failed");
    expect(() => extractRows({ error: "boom" })).toThrowError(/boom/);
    expect(() => extractRows({ _tag: "Error", message: "m" })).toThrowError(/query failed/);
  });
  it.each([["a string", "hello"], ["null", null], ["a number", 7], ["an object without rows", { data: [] }], ["rows that is not an array", { rows: "x" }]])("unexpected format (%s) ⇒ db-unexpected-shape", (_l, v) => {
    expect(code(() => extractRows(v))).toBe("db-unexpected-shape");
  });
  it("the old failure mode: accessing [0] on the result can no longer yield undefined.[0]", () => {
    for (const shape of [[{ n: 0 }], { rows: [{ n: 0 }] }]) expect(extractRows(shape)[0].n).toBe(0);
  });
});

describe("parseCliJson / runCliJson", () => {
  it("skips CLI banners before the JSON", () => {
    expect(parseCliJson('Initialising login role...\n[{"n":1}]')).toEqual([{ n: 1 }]);
    expect(parseCliJson('{"projects":[]}')).toEqual({ projects: [] });
  });
  it("rejects empty, non-JSON and truncated output explicitly", () => {
    for (const bad of ["", "no json here", '{"a":', undefined]) expect(code(() => parseCliJson(bad))).toBe("cli-output-not-json");
  });
  it("checks the exit status: a non-zero exit is cli-failed with the first stderr line, never the stdout", () => {
    const run = () => ({ status: 1, stdout: "SECRET-KEY-IN-STDOUT", stderr: "\nUnauthorized: bad token\nmore" });
    let err;
    try { runCliJson(run, ["x"], { what: "thing" }); } catch (e) { err = e; }
    expect(err.code).toBe("cli-failed");
    expect(err.message).toContain("Unauthorized: bad token");
    expect(err.message).not.toContain("SECRET-KEY");
  });
  it("returns parsed JSON for a zero exit, and a zero exit with garbage output is still an error", () => {
    expect(runCliJson(() => ({ status: 0, stdout: "[1]", stderr: "" }), [])).toEqual([1]);
    expect(code(() => runCliJson(() => ({ status: 0, stdout: "oops", stderr: "" }), []))).toBe("cli-output-not-json");
  });
});

describe("staging-project validation", () => {
  const good = { projects: [{ ref: STAGING_REF, name: "layah-staging", status: "ACTIVE_HEALTHY", region: "ap-northeast-2" }, { ref: PROD_REF, name: "teacher-app Project", status: "ACTIVE_HEALTHY" }] };
  it("accepts exactly the healthy staging project", () => {
    expect(assertStagingProject(good).ref).toBe(STAGING_REF);
  });
  it("refuses production, even by ref", () => {
    expect(code(() => assertStagingProject(good, PROD_REF))).toBe("production-refused");
  });
  it("refuses a wrong name, an unhealthy project, a missing project and a bad shape", () => {
    expect(code(() => assertStagingProject({ projects: [{ ...good.projects[0], name: "other" }] }))).toBe("project-wrong-name");
    expect(code(() => assertStagingProject({ projects: [{ ...good.projects[0], status: "INACTIVE" }] }))).toBe("project-unhealthy");
    expect(code(() => assertStagingProject({ projects: [good.projects[1]] }))).toBe("project-not-found");
    expect(code(() => assertStagingProject({ nope: 1 }))).toBe("projects-unexpected-shape");
    expect(code(() => assertStagingProject(null))).toBe("projects-unexpected-shape");
  });
});

describe("service-role key must be the staging project's", () => {
  it("accepts a staging key (either response shape)", () => {
    const k = jwt(STAGING_REF);
    expect(serviceKeyFromApiKeys([{ name: "anon", api_key: jwt(STAGING_REF) }, { name: "service_role", api_key: k }])).toBe(k);
    expect(serviceKeyFromApiKeys({ keys: [{ name: "service_role", api_key: k }] })).toBe(k);
  });
  it("refuses a production key, a foreign key, a non-JWT key, a missing key and a bad shape", () => {
    expect(code(() => serviceKeyFromApiKeys([{ name: "service_role", api_key: jwt(PROD_REF) }]))).toBe("service-key-is-production");
    expect(code(() => serviceKeyFromApiKeys([{ name: "service_role", api_key: jwt("someotherref000000000") }]))).toBe("service-key-not-staging");
    expect(code(() => serviceKeyFromApiKeys([{ name: "service_role", api_key: "sb_secret_abc" }]))).toBe("service-key-not-staging");
    expect(code(() => serviceKeyFromApiKeys([{ name: "anon", api_key: "x" }]))).toBe("service-key-missing");
    expect(code(() => serviceKeyFromApiKeys("oops"))).toBe("api-keys-unexpected-shape");
  });
  it("errors never contain the key", () => {
    const k = jwt(PROD_REF);
    try { serviceKeyFromApiKeys([{ name: "service_role", api_key: k }]); } catch (e) { expect(e.message).not.toContain(k); }
  });
});

describe("existing-user check via the Admin API (no SQL)", () => {
  const base = `https://${STAGING_REF}.supabase.co`;
  const key = jwt(STAGING_REF);
  it("detects an existing user, case-insensitively, in both response shapes", async () => {
    const wrapped = vi.fn(async () => json({ users: [{ id: "1", email: "Uvaissolanki506@Gmail.com" }], aud: "authenticated" }));
    const users = await adminListUsers(wrapped, base, key);
    expect(findUserByEmail(users, "uvaissolanki506@gmail.com")?.id).toBe("1");
    const bare = vi.fn(async () => json([{ id: "2", email: "other@x.com" }]));
    expect(findUserByEmail(await adminListUsers(bare, base, key), "uvaissolanki506@gmail.com")).toBeNull();
  });
  it("empty project: no users, no match", async () => {
    const users = await adminListUsers(vi.fn(async () => json({ users: [] })), base, key);
    expect(users).toEqual([]);
    expect(findUserByEmail(users, "a@b.co")).toBeNull();
  });
  it("paginates until a short page", async () => {
    const page = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i), email: `u${i}@x.com` }));
    const f = vi.fn(async (url) => (String(url).includes("page=1") ? json({ users: page(2) }) : json({ users: page(1) })));
    expect(await adminListUsers(f, base, key, { perPage: 2 })).toHaveLength(3);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("targets only the staging URL and sends the key only as headers", async () => {
    const f = vi.fn(async () => json({ users: [] }));
    await adminListUsers(f, base, key);
    expect(String(f.mock.calls[0][0])).toContain(`${STAGING_REF}.supabase.co`);
    expect(String(f.mock.calls[0][0])).not.toContain(key);
    expect(f.mock.calls[0][1].signal).toBeDefined();
  });
  it("explicit errors for HTTP failures and malformed bodies", async () => {
    expect(await codeAsync(adminListUsers(async () => json({ msg: "bad jwt" }, 401), base, key))).toBe("admin-api-unauthorised");
    expect(await codeAsync(adminListUsers(async () => json({ msg: "down" }, 503), base, key))).toBe("admin-api-failed");
    expect(await codeAsync(adminListUsers(async () => json({ weird: true }), base, key))).toBe("admin-api-unexpected-shape");
    expect(await codeAsync(adminListUsers(async () => new Response("<html>", { status: 200 }), base, key))).toBe("admin-api-unexpected-shape");
  });
  it("an HTTP error message never contains the key", async () => {
    try { await adminListUsers(async () => json({ msg: "nope" }, 401), base, key); } catch (e) { expect(e.message).not.toContain(key); }
  });
});

describe("creation", () => {
  const base = `https://${STAGING_REF}.supabase.co`;
  const key = jwt(STAGING_REF);
  it("sends email_confirm:true, returns the id, and never needs an email to be sent", async () => {
    const f = vi.fn(async () => json({ id: "uid-1", email: "a@b.co", email_confirmed_at: "2026-10-22T00:00:00Z" }, 200));
    expect(await adminCreateConfirmedUser(f, base, key, "a@b.co", "correct-horse-battery")).toEqual({ id: "uid-1", confirmed: true });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe(`${base}/auth/v1/admin/users`);
    expect(JSON.parse(init.body)).toMatchObject({ email: "a@b.co", email_confirm: true });
    expect(String(url)).not.toMatch(/recover|magiclink|invite|otp/);
  });
  it("an already-registered email is reported as user-exists (422), not overwritten", async () => {
    expect(await codeAsync(adminCreateConfirmedUser(async () => json({ error_code: "email_exists", msg: "A user with this email address has already been registered" }, 422), base, key, "a@b.co", "correct-horse-battery"))).toBe("user-exists");
  });
  it("the password never appears in an error", async () => {
    const pw = "super-secret-passphrase-123";
    for (const [status, body] of [[500, { msg: "boom" }], [422, { msg: "Password is too weak" }], [401, { msg: "no" }]]) {
      try { await adminCreateConfirmedUser(async () => json(body, status), base, key, "a@b.co", pw); } catch (e) { expect(e.message).not.toContain(pw); expect(e.message).not.toContain(key); }
    }
  });
  it("rejects a success response that does not contain the created user", async () => {
    expect(await codeAsync(adminCreateConfirmedUser(async () => json({}), base, key, "a@b.co", "correct-horse-battery"))).toBe("admin-api-unexpected-shape");
  });
});
