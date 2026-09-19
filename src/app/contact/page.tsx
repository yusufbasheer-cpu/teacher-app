"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Mail, ArrowUpRight } from "lucide-react";
import { PublicPage } from "@/components/marketing/public-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useErrorToast } from "@/hooks/use-error-toast";
import { toUserFacingError } from "@/lib/user-facing-errors";

const SUBJECTS = ["General Inquiry", "School Plans", "Technical Support", "Feedback"];
const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/layah.teachers" },
  { label: "LinkedIn", href: "https://linkedin.com/company/layah-ai" },
  { label: "X", href: "https://x.com/layah_ai" },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useErrorToast<string>("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
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
    <PublicPage eyebrow="Contact" title="Let’s talk about your teaching day." description="Get help with Layah, share an idea or explore what a school workspace could look like.">
      <div className="grid items-start gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
        <aside className="space-y-8">
          <div><h2 className="section-heading">A conversation with our team</h2><p className="mt-3 text-sm leading-relaxed text-muted">Tell us what you need and include any useful details. For a technical issue, the page name and error message help us find the problem.</p></div>
          <div className="border-y border-line py-6"><p className="text-sm font-medium">Prefer email?</p><a href="mailto:info@layah.in" className="mt-3 inline-flex items-center gap-2 rounded text-sm text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><Mail className="size-4" aria-hidden />info@layah.in</a><p className="mt-4 text-sm text-muted">Monday–Friday, 9 am–6 pm GST</p></div>
          <div><h3 className="text-sm font-medium">Looking for a quick answer?</h3><Link href="/faq" className="mt-2 inline-flex items-center gap-1 rounded text-sm text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Browse the help centre <ArrowUpRight className="size-4" aria-hidden /></Link></div>
          <div className="flex flex-wrap gap-5">{SOCIAL_LINKS.map((social) => <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer" className="rounded text-sm text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{social.label}<span className="sr-only"> (opens in a new tab)</span></a>)}</div>
        </aside>

        <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="contact-form-title">
          {sent ? (
            <div className="py-10" role="status">
              <CheckCircle2 className="size-10 text-brand-text" aria-hidden />
              <h2 id="contact-form-title" className="mt-5 text-2xl font-semibold">Your message is with us.</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">Thank you for getting in touch. We’ll reply to {form.email} as soon as possible.</p>
              <Button type="button" variant="outline" className="mt-6" onClick={() => { setSent(false); setForm({ name: "", email: "", subject: SUBJECTS[0], message: "" }); }}>Send another message</Button>
            </div>
          ) : (
            <>
              <h2 id="contact-form-title" className="section-heading">Send a message</h2>
              <p className="mt-2 text-sm text-muted">All fields are required.</p>
              <form onSubmit={handleSubmit} className="mt-7 space-y-5" aria-busy={sending}>
                <fieldset disabled={sending} className="space-y-5 disabled:opacity-70">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div><Label htmlFor="contact-name" className="mb-2">Your name</Label><Input id="contact-name" name="name" autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" /></div>
                    <div><Label htmlFor="contact-email" className="mb-2">Email address</Label><Input id="contact-email" name="email" autoComplete="email" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@school.edu" /></div>
                  </div>
                  <div><Label htmlFor="contact-subject" className="mb-2">What can we help with?</Label><select id="contact-subject" name="subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20">{SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></div>
                  <div><Label htmlFor="contact-message" className="mb-2">Your message</Label><textarea id="contact-message" name="message" required rows={6} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Tell us a little about what you need…" className="min-h-36 w-full resize-y rounded-lg border border-line bg-surface px-3 py-3 text-sm text-ink placeholder:text-faint outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20" /></div>
                </fieldset>
                {error ? <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5"><p className="max-w-xs text-xs leading-relaxed text-muted">We’ll use these details to respond to your enquiry. <Link href="/privacy" className="text-brand-text underline underline-offset-2">Privacy policy</Link></p><Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send message"}</Button></div>
              </form>
            </>
          )}
        </section>
      </div>
    </PublicPage>
  );
}

