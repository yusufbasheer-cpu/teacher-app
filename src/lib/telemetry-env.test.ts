import { afterEach, describe, expect, it, vi } from "vitest";
import { environmentForHost, serverEnvironment } from "./telemetry-env";

describe("environmentForHost", () => {
  it("treats the real production domains as production", () => {
    expect(environmentForHost("layah.in")).toBe("production");
    expect(environmentForHost("www.layah.in")).toBe("production");
  });

  it("treats staging and Vercel preview hosts as preview, not production", () => {
    // The whole point: these used to report into the production projects.
    expect(environmentForHost("staging.layah.in")).toBe("preview");
    expect(environmentForHost("project-scquo-abc123-teacher-app.vercel.app")).toBe("preview");
    expect(environmentForHost("project-scquo-git-staging-teacher-app.vercel.app")).toBe("preview");
  });

  it("treats local development as development", () => {
    expect(environmentForHost("localhost")).toBe("development");
    expect(environmentForHost("127.0.0.1")).toBe("development");
  });

  it("does not let a lookalike hostname pass as production", () => {
    // A subdomain or a suffix match must not be mistaken for the real domain.
    expect(environmentForHost("layah.in.evil.test")).toBe("preview");
    expect(environmentForHost("notlayah.in")).toBe("preview");
    expect(environmentForHost("staging.www.layah.in")).toBe("preview");
  });
});

describe("serverEnvironment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("follows VERCEL_ENV on Vercel", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(serverEnvironment()).toBe("production");

    vi.stubEnv("VERCEL_ENV", "preview");
    expect(serverEnvironment()).toBe("preview");
  });

  it("is not production when VERCEL_ENV is absent", () => {
    vi.stubEnv("VERCEL_ENV", "");
    expect(serverEnvironment()).toBe("development");
  });
});
