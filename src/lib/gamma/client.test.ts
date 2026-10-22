import { describe, expect, it, vi } from "vitest";
import { createGeneration, downloadGammaExport, getGeneration, hostMatches, isPrivateAddress, pollGeneration } from "./client";
import { EXPORT_HOST, fakeClock, fakeGamma, json, pptxFrom, publicResolver, testConfig } from "./test-helpers";

const config = testConfig();

describe("finding 3 — timeouts are explicit and distinct", () => {
  it("passes an AbortSignal on every Gamma call (create, status)", async () => {
    const clock = fakeClock();
    const g = fakeGamma({ pptx: Buffer.from("PK") });
    await createGeneration(config, {}, { fetchImpl: g.fetchImpl, ...clock }, clock.now() + 100_000);
    await getGeneration(config, "gen-1", { fetchImpl: g.fetchImpl, ...clock }, clock.now() + 100_000);
    expect(g.state.signalsSeen).toEqual([true, true]);
  });
  it("a stalled status call fails as request_timeout (not a hang)", async () => {
    const g = fakeGamma({ pptx: Buffer.from("PK"), statusStall: true });
    const t = Date.now();
    await expect(getGeneration(config, "gen-1", { fetchImpl: g.fetchImpl }, Date.now() + 60_000)).rejects.toMatchObject({ code: "request_timeout" });
    expect(Date.now() - t).toBeLessThan(2_000);
  });
  it("polling that outlasts the polling window fails as poll_timeout and carries the generation id", async () => {
    const clock = fakeClock();
    const g = fakeGamma({ pptx: Buffer.from("PK"), pendingPolls: 10_000 });
    await expect(pollGeneration(config, "gen-9", { fetchImpl: g.fetchImpl, ...clock }, clock.now() + 150_000)).rejects.toMatchObject({ code: "poll_timeout", extra: { generationId: "gen-9" } });
    expect(g.state.gets).toBeGreaterThan(5);
  });
  it("running out of the OVERALL budget fails as deadline_exceeded", async () => {
    const clock = fakeClock();
    const g = fakeGamma({ pptx: Buffer.from("PK"), pendingPolls: 10_000 });
    await expect(pollGeneration(config, "gen-9", { fetchImpl: g.fetchImpl, ...clock }, clock.now() + 12_000)).rejects.toMatchObject({ code: "deadline_exceeded" });
  });
  it("never starts a paid create when the overall budget is already gone (nothing submitted, definite failure)", async () => {
    const clock = fakeClock();
    const g = fakeGamma({ pptx: Buffer.from("PK") });
    await expect(createGeneration(config, {}, { fetchImpl: g.fetchImpl, ...clock }, clock.now() - 1)).rejects.toMatchObject({ code: "deadline_exceeded" });
    expect(g.state.posts).toBe(0);
  });
  it("tolerates transient poll timeouts but gives up after maxPollErrors in a row, without ever POSTing", async () => {
    const clock = fakeClock();
    const g = fakeGamma({ pptx: Buffer.from("PK"), statusStall: true });
    await expect(pollGeneration(config, "gen-1", { fetchImpl: g.fetchImpl, ...clock }, clock.now() + 150_000)).rejects.toMatchObject({ code: "api_error" });
    expect(g.state.gets).toBe(3);
    expect(g.state.posts).toBe(0);
  });
});

describe("finding 1 — create outcome classification (no automatic resubmission)", () => {
  const run = (create: Parameters<typeof fakeGamma>[0]["create"]) => {
    const clock = fakeClock();
    const g = fakeGamma({ pptx: Buffer.from("PK"), create });
    return { g, p: createGeneration(config, {}, { fetchImpl: g.fetchImpl, ...clock }, clock.now() + 150_000) };
  };
  it.each([["stall"], ["http500"], ["noid"]] as const)("%s ⇒ submission_unknown and exactly one POST", async (mode) => {
    const { g, p } = run(mode);
    await expect(p).rejects.toMatchObject({ code: "submission_unknown" });
    expect(g.state.posts).toBe(1);
  });
  it("a thrown network error ⇒ submission_unknown", async () => {
    const clock = fakeClock();
    const fetchImpl = vi.fn(async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    await expect(createGeneration(config, {}, { fetchImpl, ...clock }, clock.now() + 150_000)).rejects.toMatchObject({ code: "submission_unknown" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it.each([["http402", "insufficient_credits"], ["http400", "bad_request"]] as const)("%s is a definite failure (%s), one POST", async (mode, code) => {
    const { g, p } = run(mode);
    await expect(p).rejects.toMatchObject({ code });
    expect(g.state.posts).toBe(1);
  });
  it("retries only 429 (honouring Retry-After), at most twice, then reports rate_limited", async () => {
    const { g, p } = run("http429");
    await expect(p).rejects.toMatchObject({ code: "rate_limited" });
    expect(g.state.posts).toBe(3);
  });
});

describe("finding 2 — export host allowlist and download hardening", () => {
  const deps = async (over: Partial<{ type: string }> = {}) => {
    const pptx = await pptxFrom([["a"]]);
    const g = fakeGamma({ pptx, downloadType: over.type });
    return { g, d: { fetchImpl: g.fetchImpl, resolveHost: publicResolver } };
  };
  const dl = (url: string, d: object, cfg = config) => downloadGammaExport(cfg, url, d, Date.now() + 60_000);

  it("host matching: exact entries are exact; only *.entries match subdomains", () => {
    expect(hostMatches("a.example", ["a.example"])).toBe(true);
    expect(hostMatches("x.a.example", ["a.example"])).toBe(false);
    expect(hostMatches("x.cdn.example", ["*.cdn.example"])).toBe(true);
    expect(hostMatches("cdn.example", ["*.cdn.example"])).toBe(false);
    expect(hostMatches("evilcdn.example", ["*.cdn.example"])).toBe(false);
    expect(hostMatches("a.example.evil.com", ["a.example"])).toBe(false);
  });
  it("downloads from an allowlisted host without sending the API key", async () => {
    const { g, d } = await deps();
    const buf = await dl(`https://${EXPORT_HOST}/f.pptx?sig=SECRET-SIG`, d);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    expect(g.state.downloads).toBe(1);
  });
  it("rejects an unlisted host with an actionable message that names only the host, never the signed URL", async () => {
    const { g, d } = await deps();
    const err = await dl("https://assets.unknown.example/f.pptx?sig=SECRET-SIG", d).catch((e) => e);
    expect(err.code).toBe("download_rejected");
    expect(err.message).toContain("assets.unknown.example");
    expect(err.message).not.toContain("SECRET-SIG");
    expect(g.state.downloads).toBe(0);
  });
  it.each([
    ["http://" + EXPORT_HOST + "/f", "not HTTPS"],
    ["https://user:pw@" + EXPORT_HOST + "/f", "credentials"],
    ["https://" + EXPORT_HOST + ":8443/f", "non-standard port"],
    ["not a url", "not a valid"],
  ])("rejects %s", async (url) => {
    const { d } = await deps();
    await expect(dl(url, d)).rejects.toMatchObject({ code: "download_rejected" });
  });
  it("rejects when ANY resolved address is private/loopback/link-local, or DNS fails (fail safe)", async () => {
    const { g } = await deps();
    for (const addrs of [["10.0.0.5"], ["93.184.216.34", "127.0.0.1"], ["169.254.169.254"], ["::1"], ["fd00::1"], ["::ffff:192.168.1.1"]]) {
      await expect(dl(`https://${EXPORT_HOST}/f`, { fetchImpl: g.fetchImpl, resolveHost: async () => addrs })).rejects.toMatchObject({ code: "download_rejected" });
    }
    await expect(dl(`https://${EXPORT_HOST}/f`, { fetchImpl: g.fetchImpl, resolveHost: async () => { throw new Error("ENOTFOUND"); } })).rejects.toMatchObject({ code: "download_rejected" });
    expect(g.state.downloads).toBe(0);
  });
  it("isPrivateAddress covers the reserved ranges", () => {
    for (const a of ["0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.0.1", "224.0.0.1", "fe80::1", "garbage"]) expect(isPrivateAddress(a), a).toBe(true);
    for (const a of ["8.8.8.8", "172.32.0.1", "93.184.216.34", "2606:4700::1"]) expect(isPrivateAddress(a), a).toBe(false);
  });
  it("rejects redirects, wrong content-type, oversize (declared and streamed) and non-zip bodies", async () => {
    const mk = (res: () => Response) => ({ fetchImpl: (async () => res()) as unknown as typeof fetch, resolveHost: publicResolver });
    const u = `https://${EXPORT_HOST}/f`;
    await expect(dl(u, mk(() => new Response(null, { status: 302, headers: { location: "https://evil.example" } })))).rejects.toMatchObject({ code: "download_rejected" });
    await expect(dl(u, mk(() => new Response("PKxx", { status: 200, headers: { "content-type": "text/html" } })))).rejects.toMatchObject({ code: "download_rejected" });
    await expect(dl(u, mk(() => new Response(new Uint8Array(100), { status: 200, headers: { "content-length": "100" } })), { ...config, maxDownloadBytes: 10 })).rejects.toMatchObject({ code: "download_rejected" });
    await expect(dl(u, mk(() => new Response(new Uint8Array(100), { status: 200 })), { ...config, maxDownloadBytes: 10 })).rejects.toMatchObject({ code: "download_rejected" });
    await expect(dl(u, mk(() => new Response("<html>nope</html>", { status: 200, headers: { "content-type": "application/octet-stream" } })))).rejects.toMatchObject({ code: "invalid_export" });
  });
  it("accepts the PPTX mime type and octet-stream", async () => {
    for (const type of ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream; charset=binary"]) {
      const { d } = await deps({ type });
      await expect(dl(`https://${EXPORT_HOST}/f`, d)).resolves.toBeTruthy();
    }
  });
  it("a stalled download aborts with a timeout instead of hanging", async () => {
    const fetchImpl = (async (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_, rej) => init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "TimeoutError" }))))) as unknown as typeof fetch;
    await expect(dl(`https://${EXPORT_HOST}/f`, { fetchImpl, resolveHost: publicResolver }, { ...config, requestTimeoutMs: 10 })).rejects.toMatchObject({ code: "request_timeout" });
  });
});

describe("status parsing", () => {
  it("maps completed / failed / pending and credits", async () => {
    const mk = (body: unknown) => ({ fetchImpl: (async () => json(body)) as unknown as typeof fetch });
    const dl = Date.now() + 60_000;
    expect(await getGeneration(config, "g", mk({ status: "pending" }), dl)).toEqual({ state: "pending" });
    expect(await getGeneration(config, "g", mk({ status: "completed", exportUrl: "https://x", credits: { deducted: 3, remaining: 9 } }), dl)).toMatchObject({ state: "completed", credits: { deducted: 3, remaining: 9 } });
    expect(await getGeneration(config, "g", mk({ status: "failed", error: { message: "bad", statusCode: 500 } }), dl)).toMatchObject({ state: "failed", message: "bad" });
  });
  it("maps HTTP errors on status lookups (401 invalid credentials)", async () => {
    const fetchImpl = (async () => json({}, 401)) as unknown as typeof fetch;
    await expect(getGeneration(config, "g", { fetchImpl }, Date.now() + 1000)).rejects.toMatchObject({ code: "invalid_credentials" });
  });
});
