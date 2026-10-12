import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.hoisted(() => vi.fn());
const applySchoolPlanForEmail = vi.hoisted(() => vi.fn());
const sendWelcomeEmailIfNew = vi.hoisted(() => vi.fn());
const hasCompletedTeacherProfile = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase-ssr", () => ({
  createServerSupabaseClient: async () => ({ auth: { verifyOtp } }),
}));
vi.mock("@/lib/auth-callback-school", () => ({ applySchoolPlanForEmail }));
vi.mock("@/lib/welcome-email", () => ({ sendWelcomeEmailIfNew }));
vi.mock("@/lib/user-profile", () => ({ hasCompletedTeacherProfile }));

describe("email confirmation callback", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    applySchoolPlanForEmail.mockReset().mockResolvedValue({ matched: false });
    sendWelcomeEmailIfNew.mockReset().mockResolvedValue("sent");
    hasCompletedTeacherProfile.mockReset().mockReturnValue(false);
  });

  it("verifies the email token without needing a PKCE code or browser cookie", async () => {
    const user = { id: "user-1", email: "teacher@example.test", user_metadata: { full_name: "Teacher" } };
    verifyOtp.mockResolvedValue({ data: { user }, error: null });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://www.layah.in/auth/confirm?token_hash=hashed-token&type=email"),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hashed-token", type: "email" });
    expect(applySchoolPlanForEmail).toHaveBeenCalledWith("user-1", "teacher@example.test", expect.anything());
    expect(sendWelcomeEmailIfNew).toHaveBeenCalledWith("user-1", "teacher@example.test", "Teacher");
    expect(response.headers.get("location")).toBe("https://www.layah.in/onboarding");
  });

  it("sends an already set up teacher to the dashboard", async () => {
    const user = { id: "user-1", email: "teacher@example.test", user_metadata: { profile_completed: true } };
    verifyOtp.mockResolvedValue({ data: { user }, error: null });
    hasCompletedTeacherProfile.mockReturnValue(true);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://www.layah.in/auth/confirm?token_hash=hashed-token&type=email"),
    );

    expect(response.headers.get("location")).toBe("https://www.layah.in/dashboard");
  });

  it("rejects missing tokens without calling Supabase", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("https://www.layah.in/auth/confirm?type=email"));

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("/login?error=");
  });

  it("directs users with expired links to login or a new link", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: new Error("expired") });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://www.layah.in/auth/confirm?token_hash=expired&type=email"),
    );

    expect(sendWelcomeEmailIfNew).not.toHaveBeenCalled();
    expect(new URL(response.headers.get("location")!).searchParams.get("error")).toContain(
      "expired or was already used",
    );
  });
});
