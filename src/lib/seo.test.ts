import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { posts } from "@/content/blog/posts";
import { escapeHtml, parseContactBody } from "@/lib/contact-form";
import { isTrackablePath } from "@/lib/analytics-consent";
import { SITE_URL, isIndexableDeployment } from "@/lib/site";

afterEach(() => vi.unstubAllEnvs());

describe("robots", () => {
  it("blocks everything outside production (previews, Gamma staging)", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("in production allows the site, hides private areas, and links the www sitemap", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(expect.arrayContaining(["/api/", "/dashboard", "/my-lesson-plans", "/super-admin"]));
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("only treats VERCEL_ENV=production as indexable", () => {
    expect(isIndexableDeployment("production")).toBe(true);
    expect(isIndexableDeployment("preview")).toBe(false);
    expect(isIndexableDeployment(undefined)).toBe(false);
  });
});

describe("sitemap", () => {
  const urls = sitemap().map((e) => e.url);

  it("uses absolute www URLs with no duplicates", () => {
    expect(urls.every((u) => u === SITE_URL || u.startsWith(`${SITE_URL}/`))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("lists every blog post and excludes redirects and private routes", () => {
    for (const p of posts) expect(urls).toContain(`${SITE_URL}/blog/${p.slug}`);
    for (const bad of ["/landing", "/login", "/signup", "/dashboard", "/api"]) {
      expect(urls.some((u) => u.includes(bad))).toBe(false);
    }
  });
});

describe("contact form validation", () => {
  const ok = { name: "Asha", email: "asha@school.org", subject: "General Inquiry", message: "Do you support IB?" };

  it("accepts a valid submission and trims input", () => {
    expect(parseContactBody({ ...ok, name: "  Asha " })).toEqual({ ok: true, value: ok });
  });

  it.each([
    [{ ...ok, name: "" }, "name"],
    [{ ...ok, email: "not-an-email" }, "email"],
    [{ ...ok, subject: "Hi\r\nBcc: x@evil.com" }, "subject"],
    [{ ...ok, message: "short" }, "message"],
    [{ ...ok, message: "x".repeat(5001) }, "message"],
    [null, "name"],
  ])("rejects bad input (%#)", (input, field) => {
    const r = parseContactBody(input);
    expect(r).toMatchObject({ ok: false, field });
  });

  it("escapes HTML so submitted markup cannot reach the inbox as live HTML", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
});

describe("analytics path filter", () => {
  it("tracks public pages but not signed-in or admin areas", () => {
    expect(isTrackablePath("/pricing")).toBe(true);
    expect(isTrackablePath("/blog/some-post")).toBe(true);
    expect(isTrackablePath("/my-lesson-plans/abc")).toBe(false);
    expect(isTrackablePath("/super-admin")).toBe(false);
    expect(isTrackablePath("/auth/callback")).toBe(false);
  });
});
