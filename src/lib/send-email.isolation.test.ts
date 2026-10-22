import { afterEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn(async () => ({ messageId: "x" })));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));

import { sendEmail } from "./send-email";

const smtp = { SMTP_HOST: "smtp.example", SMTP_USER: "u", SMTP_PASSWORD: "p", SMTP_FROM: "Layah <hi@example>" };
const mail = { to: "tester@example.com", subject: "Welcome", text: "hi" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("outbound email from an isolated experimental environment", () => {
  it("is never sent, even with SMTP credentials configured", async () => {
    Object.entries({ ...smtp, GAMMA_ENVIRONMENT_NAME: "staging" }).forEach(([k, v]) => vi.stubEnv(k, v));
    expect(await sendEmail(mail)).toEqual({ ok: false, error: "SMTP not configured" });
    expect(sendMail).not.toHaveBeenCalled();
  });
  it("is unchanged in production and ordinary previews", async () => {
    Object.entries(smtp).forEach(([k, v]) => vi.stubEnv(k, v));
    expect((await sendEmail(mail)).ok).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    vi.stubEnv("GAMMA_ENVIRONMENT_NAME", "production");
    expect((await sendEmail(mail)).ok).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});
