"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SESSION_REVOKED_MESSAGE } from "@/lib/active-session";
import { completeEmailPostAuthLogin } from "@/lib/auth-post-login";
import { supabase } from "@/lib/supabase";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

const MIN_SIGNUP_MS = 3000;

type AuthMode = "login" | "signup";

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
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Bot protection
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const formLoadTime = useRef(Date.now());

  const onTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), []);
  const onTurnstileExpire = useCallback(() => setTurnstileToken(null), []);

  useEffect(() => {
    if (searchParams.get("revoked") === "1") {
      setError(SESSION_REVOKED_MESSAGE);
      return;
    }
    const authError = searchParams.get("error");
    if (authError) {
      setError(decodeURIComponent(authError));
    }
  }, [searchParams]);

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
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setGoogleLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
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

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
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
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="mx-auto w-full max-w-md rounded-3xl border bg-[#FAF6EF] p-6 shadow-sm md:p-8"
      style={{ borderColor: "rgba(14, 148, 132,0.2)" }}
    >
      <p
        className="mb-3 inline-flex gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
        style={{ borderColor: "#0E9484", color: "#0E9484", background: "rgba(14, 148, 132,0.08)" }}
      >
        <span>Welcome to </span>
        <span className="font-layah-logo">Layah.ai</span>
      </p>
      <h1 className="text-2xl font-bold" style={{ color: "#241A12" }}>
        {mode === "login" ? "Teacher Login" : "Create Teacher Account"}
      </h1>
      <p className="mt-2 text-sm" style={{ color: "#6B5D4F" }}>
        {mode === "login"
          ? "Login to access your lesson plans."
          : "Sign up with email and password."}
      </p>

      <button
        type="button"
        onClick={() => void onGoogleSignIn()}
        disabled={loading || googleLoading}
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border bg-[#FAF6EF] px-4 py-2.5 text-sm font-semibold transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-70"
        style={{ borderColor: "#dadce0", color: "#241A12" }}
      >
        {googleLoading ? (
          <GoogleSpinner />
        ) : (
          <GoogleLogo />
        )}
        <span>{googleLoading ? "Connecting…" : "Continue with Google"}</span>
      </button>

      <p className="mt-3 text-center text-xs leading-relaxed" style={{ color: "#7a6e5f" }}>
        School teachers: Sign in with your school Google account to access your school plan
      </p>

      <div className="relative my-6">
        <div
          className="absolute inset-0 flex items-center"
          aria-hidden
        >
          <div className="w-full border-t" style={{ borderColor: "#E3D9C8" }} />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-[#FAF6EF] px-3 font-medium" style={{ color: "#a79a87" }}>
            OR
          </span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
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

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium" style={{ color: "#241A12" }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
            style={{ borderColor: "#D9CCB8", color: "#241A12" }}
            onFocus={(e) => (e.target.style.borderColor = "#0E9484")}
            onBlur={(e) => (e.target.style.borderColor = "#D9CCB8")}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium" style={{ color: "#241A12" }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
            style={{ borderColor: "#D9CCB8", color: "#241A12" }}
            onFocus={(e) => (e.target.style.borderColor = "#0E9484")}
            onBlur={(e) => (e.target.style.borderColor = "#D9CCB8")}
            required
          />
        </div>

        {mode === "signup" && (
          <TurnstileWidget
            onVerify={onTurnstileVerify}
            onExpire={onTurnstileExpire}
          />
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          style={{ background: "#0E9484" }}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
              ? "Login"
              : "Create Account"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mt-3 text-sm" style={{ color: "#0B6B5F" }}>{message}</p> : null}

      {linkMode ? (
        <Link
          href={mode === "login" ? "/signup" : "/login"}
          className="mt-4 inline-block text-sm font-medium transition hover:opacity-80"
          style={{ color: "#0E9484" }}
        >
          {mode === "login"
            ? "Need an account? Sign up"
            : "Already have an account? Login"}
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
          }}
          className="mt-4 text-sm font-medium transition hover:opacity-80"
          style={{ color: "#0E9484" }}
        >
          {mode === "login"
            ? "Need an account? Sign up"
            : "Already have an account? Login"}
        </button>
      )}
    </div>
  );
}
