"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { registerActiveSession, SESSION_REVOKED_MESSAGE } from "@/lib/active-session";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";

export function AuthCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("revoked") === "1") {
      setError(SESSION_REVOKED_MESSAGE);
    }
  }, [searchParams]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) throw signUpError;

        if (data.session?.user) {
          await registerActiveSession(data.session.user.id);
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
          await registerActiveSession(session.user.id);
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
      className="mx-auto w-full max-w-md rounded-3xl border bg-white p-6 shadow-sm md:p-8"
      style={{ borderColor: "rgba(0,198,167,0.2)" }}
    >
      <p
        className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
        style={{ borderColor: "#00C6A7", color: "#00C6A7", background: "rgba(0,198,167,0.08)" }}
      >
        <span>Welcome to </span>
        <span className="font-layah-logo">Layah.ai</span>
      </p>
      <h1 className="text-2xl font-bold" style={{ color: "#0A1628" }}>
        {mode === "login" ? "Teacher Login" : "Create Teacher Account"}
      </h1>
      <p className="mt-2 text-sm" style={{ color: "#4A5568" }}>
        {mode === "login"
          ? "Login to access your lesson plans."
          : "Sign up with email and password."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium" style={{ color: "#0A1628" }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
            style={{ borderColor: "#CBD5E0", color: "#0A1628" }}
            onFocus={(e) => (e.target.style.borderColor = "#00C6A7")}
            onBlur={(e) => (e.target.style.borderColor = "#CBD5E0")}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium" style={{ color: "#0A1628" }}>
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
            style={{ borderColor: "#CBD5E0", color: "#0A1628" }}
            onFocus={(e) => (e.target.style.borderColor = "#00C6A7")}
            onBlur={(e) => (e.target.style.borderColor = "#CBD5E0")}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          style={{ background: "#00C6A7" }}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
              ? "Login"
              : "Create Account"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mt-3 text-sm" style={{ color: "#0A8F7A" }}>{message}</p> : null}

      <button
        type="button"
        onClick={() => {
          setMode((prev) => (prev === "login" ? "signup" : "login"));
          setError(null);
          setMessage(null);
        }}
        className="mt-4 text-sm font-medium transition hover:opacity-80"
        style={{ color: "#00C6A7" }}
      >
        {mode === "login"
          ? "Need an account? Sign up"
          : "Already have an account? Login"}
      </button>
    </div>
  );
}
