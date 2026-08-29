"use client";

import { useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Footer } from "@/components/layout/footer";
import { useErrorToast } from "@/hooks/use-error-toast";
import { toUserFacingError } from "@/lib/user-facing-errors";

const NAVY = "#241A12";
const TEAL = "#0E9484";

const SUBJECTS = ["General Inquiry", "School Plans", "Technical Support", "Feedback"];

function MailIcon() {
  return (
    <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

const CONTACT_INFO = [
  { icon: MailIcon, label: "Email", value: "info@layah.in", href: "mailto:info@layah.in" },
  { icon: ClockIcon, label: "Response Time", value: "Within 24 hours" },
  { icon: CalendarIcon, label: "Support Hours", value: "Mon – Fri, 9 AM – 6 PM GST" },
];

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/layah.teachers?igsh=NHAwOGFoaXNkc2hh&utm_source=qr" },
  { label: "LinkedIn", href: "https://linkedin.com/company/layah-ai" },
  { label: "X (Twitter)", href: "https://x.com/layah_ai" },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useErrorToast<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Failed to send message");
      }
      setSent(true);
    } catch (err: unknown) {
      setError(toUserFacingError(err, "contact-form"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#F1E9DC", color: NAVY }}>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28" style={{ background: NAVY }}>
        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 70% 50%, ${TEAL}33, transparent 60%)` }} />
        <Container>
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ background: "rgba(14, 148, 132,0.15)", color: TEAL }}>
              Contact Us
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl" style={{ fontWeight: 700 }}>
              We would love to hear from you
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/60">
              Whether you have a question, feedback, or want to explore school plans — reach out and we will get back to you.
            </p>
          </div>
        </Container>
      </section>

      {/* Contact Details + Form */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-5">
            {/* Details card */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border bg-[#FAF6EF] p-6 shadow-sm sm:p-8" style={{ borderColor: "rgba(14, 148, 132,0.15)" }}>
                <h2 className="text-lg font-bold" style={{ color: NAVY }}>Get in Touch</h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
                  We are here to help. Reach out through any of these channels.
                </p>
                <div className="mt-6 space-y-5">
                  {CONTACT_INFO.map((item) => (
                    <div key={item.label} className="flex gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(14, 148, 132,0.1)", color: TEAL }}>
                        <item.icon />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#A79A87" }}>{item.label}</p>
                        {item.href ? (
                          <a href={item.href} className="text-sm font-medium transition hover:opacity-80" style={{ color: TEAL }}>{item.value}</a>
                        ) : (
                          <p className="text-sm font-medium" style={{ color: NAVY }}>{item.value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 border-t pt-6" style={{ borderColor: "#E3D9C8" }}>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#A79A87" }}>Follow Us</p>
                  <div className="flex gap-3">
                    {SOCIAL_LINKS.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
                        style={{ background: "rgba(14, 148, 132,0.1)", color: TEAL }}
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border bg-[#FAF6EF] p-6 shadow-sm sm:p-8" style={{ borderColor: "rgba(14, 148, 132,0.15)" }}>
                {sent ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full" style={{ background: "rgba(14, 148, 132,0.15)" }}>
                      <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke={TEAL} strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold" style={{ color: NAVY }}>Message Sent!</h3>
                    <p className="mt-2 text-sm" style={{ color: "#6B5D4F" }}>
                      Thank you for reaching out. We will get back to you within 24 hours.
                    </p>
                    <Link href="/" className="mt-6 inline-flex rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90" style={{ background: TEAL }}>
                      Back to Home
                    </Link>
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-bold" style={{ color: NAVY }}>Send us a message</h2>
                    <p className="mt-1 text-sm" style={{ color: "#6B5D4F" }}>
                      Fill out the form below and we will respond as soon as possible.
                    </p>
                    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                      <div>
                        <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium" style={{ color: NAVY }}>Name</label>
                        <input
                          id="contact-name"
                          required
                          type="text"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition focus:ring-2"
                          style={{ borderColor: "#E3D9C8", color: NAVY }}
                          placeholder="Your name"
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium" style={{ color: NAVY }}>Email</label>
                        <input
                          id="contact-email"
                          required
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition focus:ring-2"
                          style={{ borderColor: "#E3D9C8", color: NAVY }}
                          placeholder="you@example.com"
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-subject" className="mb-1.5 block text-sm font-medium" style={{ color: NAVY }}>Subject</label>
                        <select
                          id="contact-subject"
                          value={form.subject}
                          onChange={(e) => setForm({ ...form, subject: e.target.value })}
                          className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition focus:ring-2"
                          style={{ borderColor: "#E3D9C8", color: NAVY }}
                        >
                          {SUBJECTS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium" style={{ color: NAVY }}>Message</label>
                        <textarea
                          id="contact-message"
                          required
                          rows={5}
                          value={form.message}
                          onChange={(e) => setForm({ ...form, message: e.target.value })}
                          className="w-full resize-none rounded-lg border px-4 py-2.5 text-sm outline-none transition focus:ring-2"
                          style={{ borderColor: "#E3D9C8", color: NAVY }}
                          placeholder="How can we help you?"
                        />
                      </div>
                      {error ? (
                        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
                      ) : null}
                      <button
                        type="submit"
                        disabled={sending}
                        className="flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                        style={{ background: TEAL }}
                      >
                        {sending ? "Sending..." : "Send Message"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
