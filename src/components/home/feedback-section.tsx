"use client";

import { useState } from "react";

const ROLES = ["Teacher", "Head of Department", "Principal", "School Admin", "Other"];

const TEAL = "#00C6A7";
const NAVY = "#0A1628";

export function FeedbackSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please share your feedback before submitting.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, rating, message }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Something went wrong.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hovered || rating;

  return (
    <section className="py-20 md:py-28" style={{ background: "#FFFFFF" }}>
      <div className="mx-auto max-w-2xl px-6">
        {/* Heading */}
        <div className="mb-10 text-center">
          <p className="font-caveat mb-2 text-xl font-semibold" style={{ color: TEAL }}>
            Your voice matters 💬
          </p>
          <h2 className="text-3xl font-extrabold sm:text-4xl" style={{ color: NAVY }}>
            We Would Love to Hear From You 💬
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed" style={{ color: "#374151" }}>
            Help us make Layah better for teachers worldwide
          </p>
        </div>

        {submitted ? (
          /* Thank you state */
          <div
            className="rounded-3xl border p-10 text-center shadow-sm"
            style={{ borderColor: "rgba(0,198,167,0.25)", background: "#F0FDFB" }}
          >
            <p className="text-5xl">🎉</p>
            <h3 className="mt-4 text-2xl font-bold" style={{ color: NAVY }}>
              Thank you for your feedback!
            </h3>
            <p className="mt-3 text-base" style={{ color: "#374151" }}>
              We really appreciate it 🎉
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setName("");
                setEmail("");
                setRole("");
                setRating(0);
                setMessage("");
              }}
              className="mt-6 rounded-xl px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: TEAL }}
            >
              Submit another
            </button>
          </div>
        ) : (
          /* Form */
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="rounded-3xl border bg-white p-7 shadow-sm md:p-9"
            style={{ borderColor: "rgba(0,198,167,0.2)" }}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Name */}
              <div>
                <label htmlFor="fb-name" className="mb-1.5 block text-sm font-medium" style={{ color: NAVY }}>
                  Name
                </label>
                <input
                  id="fb-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none ring-[#00C6A7] focus:ring-2"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="fb-email" className="mb-1.5 block text-sm font-medium" style={{ color: NAVY }}>
                  Email
                </label>
                <input
                  id="fb-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none ring-[#00C6A7] focus:ring-2"
                />
              </div>

              {/* Role */}
              <div className="sm:col-span-2">
                <label htmlFor="fb-role" className="mb-1.5 block text-sm font-medium" style={{ color: NAVY }}>
                  Role
                </label>
                <select
                  id="fb-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none ring-[#00C6A7] focus:ring-2"
                >
                  <option value="">Select your role…</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Star rating */}
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium" style={{ color: NAVY }}>Rating</p>
              <div className="flex gap-1.5" onMouseLeave={() => setHovered(0)}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHovered(star)}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    className="text-3xl transition-transform hover:scale-110 focus:outline-none"
                    style={{ color: star <= displayRating ? "#F59E0B" : "#D1D5DB" }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="mt-5">
              <label htmlFor="fb-message" className="mb-1.5 block text-sm font-medium" style={{ color: NAVY }}>
                Feedback <span className="text-red-500">*</span>
              </label>
              <textarea
                id="fb-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                placeholder="Share your thoughts, suggestions, or what you love about Layah..."
                className="w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none ring-[#00C6A7] focus:ring-2"
              />
            </div>

            {error ? (
              <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-70 sm:w-auto sm:min-w-48"
              style={{ background: TEAL }}
            >
              {submitting ? "Sending…" : "Send Feedback"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
