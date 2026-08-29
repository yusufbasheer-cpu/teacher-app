"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, type Variants } from "motion/react";
import { SESSION_REVOKED_MESSAGE } from "@/lib/active-session";
import { completeEmailPostAuthLogin, completePhonePostAuthLogin } from "@/lib/auth-post-login";
import { supabase } from "@/lib/supabase";
import { sanitizeUserMessage, toUserFacingError } from "@/lib/user-facing-errors";
import { useErrorToast } from "@/hooks/use-error-toast";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

const MIN_SIGNUP_MS = 3000;

type AuthMode = "login" | "signup";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GoogleSpinner() {
  return (
    <svg
      className="size-5 animate-spin text-stone-500"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

type AuthCardProps = {
  /** Initial form mode. Defaults to "login" (unchanged from before this prop existed). */
  defaultMode?: AuthMode;
  /**
   * When true, the "switch mode" link at the bottom navigates to the dedicated
   * /login or /signup route instead of flipping local state. Used by those
   * two routes; /auth keeps the original same-page toggle behavior.
   */
  linkMode?: boolean;
};

export function AuthCard({ defaultMode = "login", linkMode = false }: AuthCardProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [identifier, setIdentifier] = useState<"email" | "phone">("email");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useErrorToast();
  const [message, setMessage] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Bot protection
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const formLoadTime = useRef(Date.now());

  const onTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), []);
  const onTurnstileExpire = useCallback(() => setTurnstileToken(null), []);

  useEffect(() => {
    // Show a one-time error carried in the URL from a failed redirect (e.g. OAuth
    // callback failure, forced session revocation), then strip it from the URL so
    // a refresh or a later visit to this same link doesn't keep re-showing it —
    // a fresh login/signup attempt should never be blocked by a past failure.
    if (searchParams.get("revoked") === "1") {
      setError(SESSION_REVOKED_MESSAGE);
      router.replace(pathname, { scroll: false });
      return;
    }
    const authError = searchParams.get("error");
    if (authError) {
      setError(sanitizeUserMessage(decodeURIComponent(authError), "auth-query-param"));
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  const onGoogleSignIn = async () => {
    setError(null);
    setMessage(null);
    setGoogleLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/auth/callback",
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(toUserFacingError(err, "auth-google-signin"));
      setGoogleLoading(false);
    }
  };

  const onResendConfirmation = async () => {
    setError(null);
    setMessage(null);
    setResendLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });
      if (resendError) throw resendError;
      setMessage("Confirmation email sent. Check your inbox (and spam folder).");
    } catch (err) {
      setError(toUserFacingError(err, "auth-resend-confirmation"));
    } finally {
      setResendLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setShowResend(false);
    setLoading(true);

    try {
      if (mode === "signup") {
        // 1. Honeypot — bots fill hidden fields, humans never see it
        if (honeypot) {
          setLoading(false);
          return;
        }

        // 2. Time check — < 3 s means automated submission
        if (Date.now() - formLoadTime.current < MIN_SIGNUP_MS) {
          setLoading(false);
          return;
        }

        // 3. Turnstile — only if the site key is configured
        if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
          if (!turnstileToken) {
            setError("Please complete the verification before signing up.");
            setLoading(false);
            return;
          }
          const captchaRes = await fetch("/api/auth/verify-captcha", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: turnstileToken }),
          });
          const captchaData = (await captchaRes.json()) as { ok: boolean; error?: string };
          if (!captchaData.ok) {
            setError(captchaData.error ?? "Verification failed. Please try again.");
            setTurnstileToken(null);
            setLoading(false);
            return;
          }
        }

        if (identifier === "phone") {
          const res = await fetch("/api/auth/signup-with-phone", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim(), password }),
          });
          const data = (await res.json()) as {
            access_token?: string;
            refresh_token?: string;
            error?: string;
          };

          if (!res.ok || !data.access_token || !data.refresh_token) {
            setError(data.error ?? "Something went wrong creating your account.");
            setLoading(false);
            return;
          }

          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
          if (setSessionError) throw setSessionError;

          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            const postAuth = await completePhonePostAuthLogin(session.user.id);
            if (!postAuth.ok) {
              setError(postAuth.message);
              return;
            }
          }
          router.push("/lesson-plan");
          router.refresh();
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data.session?.user) {
          const postAuth = await completeEmailPostAuthLogin(data.session.user.id);
          if (!postAuth.ok) {
            setError(postAuth.message);
            return;
          }
          router.push("/lesson-plan");
          router.refresh();
          return;
        }

        setMessage(
          "Account created. If email confirmation is enabled, check your inbox before logging in.",
        );
        setMode("login");
      } else if (identifier === "phone") {
        const res = await fetch("/api/auth/login-with-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phone.trim(), password }),
        });
        const data = (await res.json()) as {
          access_token?: string;
          refresh_token?: string;
          error?: string;
        };

        if (!res.ok || !data.access_token || !data.refresh_token) {
          setError(data.error ?? "Invalid phone number or password.");
          setLoading(false);
          return;
        }

        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (setSessionError) throw setSessionError;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const postAuth = await completePhonePostAuthLogin(session.user.id);
          if (!postAuth.ok) {
            setError(postAuth.message);
            return;
          }
        }
        router.push("/lesson-plan");
        router.refresh();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const postAuth = await completeEmailPostAuthLogin(session.user.id);
          if (!postAuth.ok) {
            setError(postAuth.message);
            return;
          }
        }
        router.push("/lesson-plan");
        router.refresh();
      }
    } catch (err) {
      const code = typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
      if (mode === "login" && code === "invalid_credentials") {
        setError(
          "Invalid email or password. If you just signed up, you'll need to confirm your email first.",
        );
        setShowResend(true);
      } else {
        setError(toUserFacingError(err, "auth-submit"));
      }
    } finally {
      setLoading(false);
    }
  };

  const footerPrefix = mode === "login" ? "Need an account?" : "Already have an account?";
  const footerAction = mode === "login" ? "Sign up" : "Login";
  const inputClass =
    "w-full rounded-[14px] border bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-stone-400";
  const inputStyle = { borderColor: "#D9CCB8", color: "#241A12" };
  const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = "#0E9484");
  const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = "#D9CCB8");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-[400px]"
    >
      <motion.div variants={itemVariants} className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#241A12" }}>
          {mode === "login" ? "Teacher Login" : "Create Teacher Account"}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#6B5D4F" }}>
          {mode === "login"
            ? "Login to access your lesson plans."
            : "Tell us a bit about yourself to get started."}
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="mb-6">
        <button
          type="button"
          onClick={() => void onGoogleSignIn()}
          disabled={loading || googleLoading}
          className="flex w-full items-center justify-center gap-3 rounded-full border bg-white py-3.5 text-[13px] font-semibold transition-transform hover:bg-stone-50 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-70"
          style={{ borderColor: "#dadce0", color: "#241A12" }}
        >
          {googleLoading ? <GoogleSpinner /> : <GoogleLogo />}
          <span>{googleLoading ? "Connecting…" : "Continue with Google"}</span>
        </button>

        <p className="mt-3 text-center text-xs leading-relaxed" style={{ color: "#7a6e5f" }}>
          School teachers: Sign in with your school Google account to access your school plan
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="relative mb-6 flex items-center">
        <div className="grow border-t" style={{ borderColor: "#E3D9C8" }} />
        <span className="px-4 text-[11px] font-semibold tracking-wider uppercase" style={{ color: "#a79a87" }}>
          Or
        </span>
        <div className="grow border-t" style={{ borderColor: "#E3D9C8" }} />
      </motion.div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {/* Honeypot — invisible to humans, bots fill it. Must use CSS positioning, NOT display:none */}
        <div style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }} aria-hidden="true">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {mode === "signup" && (
          <motion.div variants={itemVariants} className="flex flex-col gap-2">
            <label htmlFor="full-name" className="text-sm font-medium" style={{ color: "#241A12" }}>
              Full name
            </label>
            <input
              id="full-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className={inputClass}
              style={inputStyle}
              onFocus={onInputFocus}
              onBlur={onInputBlur}
              required
            />
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="flex gap-1 rounded-full p-1" style={{ background: "rgba(14, 148, 132,0.08)" }}>
          {(["email", "phone"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setIdentifier(option)}
              className="flex-1 rounded-full py-1.5 text-xs font-semibold capitalize transition"
              style={{
                background: identifier === option ? "#FAF6EF" : "transparent",
                color: identifier === option ? "#0E9484" : "#7a6e5f",
                boxShadow: identifier === option ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {option}
            </button>
          ))}
        </motion.div>

        {identifier === "email" ? (
          <motion.div variants={itemVariants} className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium" style={{ color: "#241A12" }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className={inputClass}
              style={inputStyle}
              onFocus={onInputFocus}
              onBlur={onInputBlur}
              required
            />
          </motion.div>
        ) : (
          <motion.div variants={itemVariants} className="flex flex-col gap-2">
            <label htmlFor="phone" className="text-sm font-medium" style={{ color: "#241A12" }}>
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              pattern="^\+?[0-9\s\-()]{7,20}$"
              title="Enter a valid phone number, with country code if possible"
              className={inputClass}
              style={inputStyle}
              onFocus={onInputFocus}
              onBlur={onInputBlur}
              required
            />
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-medium" style={{ color: "#241A12" }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            minLength={6}
            className={inputClass}
            style={inputStyle}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
            required
          />
        </motion.div>

        {mode === "signup" && (
          <motion.div variants={itemVariants}>
            <TurnstileWidget
              onVerify={onTurnstileVerify}
              onExpire={onTurnstileExpire}
            />
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="mt-1">
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full rounded-full py-3.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(14,148,132,0.15)] transition-transform hover:opacity-90 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-70"
            style={{ background: "#0E9484" }}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>
        </motion.div>
      </form>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {showResend ? (
        <button
          type="button"
          onClick={() => void onResendConfirmation()}
          disabled={resendLoading}
          className="mt-2 text-sm font-medium underline transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-70"
          style={{ color: "#0E9484" }}
        >
          {resendLoading ? "Sending…" : "Resend confirmation email"}
        </button>
      ) : null}
      {message ? <p className="mt-3 text-sm" style={{ color: "#0B6B5F" }}>{message}</p> : null}

      <motion.div variants={itemVariants} className="mt-6 text-center text-[13px]" style={{ color: "#6B5D4F" }}>
        {footerPrefix}{" "}
        {linkMode ? (
          <Link
            href={mode === "login" ? "/signup" : "/login"}
            className="font-bold transition hover:underline"
            style={{ color: "#241A12" }}
          >
            {footerAction}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMode((prev) => {
                if (prev === "login") {
                  formLoadTime.current = Date.now();
                  setTurnstileToken(null);
                }
                return prev === "login" ? "signup" : "login";
              });
              setError(null);
              setMessage(null);
              setShowResend(false);
            }}
            className="font-bold transition hover:underline"
            style={{ color: "#241A12" }}
          >
            {footerAction}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
