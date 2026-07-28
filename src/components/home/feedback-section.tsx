"use client";

import { useState } from "react";
import { Container } from "@/components/ui/container";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/marketing/section-label";

const ROLES = ["Teacher", "Head of Department", "Principal", "School Admin", "Other"];

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
    <section className="border-t border-border py-20 md:py-28">
      <Container className="max-w-2xl">
        <div className="mb-10 text-center">
          <SectionLabel className="justify-center flex">Your voice matters</SectionLabel>
          <h2 className="font-display mt-3 text-3xl font-semibold text-navy sm:text-4xl">
            We&apos;d love to hear from you
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            Help us make Layah better for teachers worldwide.
          </p>
        </div>

        {submitted ? (
          <Card className="border-primary/25 bg-primary/5 py-10 text-center shadow-none">
            <CardContent>
              <h3 className="font-display text-2xl font-semibold text-navy">
                Thank you for your feedback
              </h3>
              <p className="mt-3 text-base text-muted-foreground">We really appreciate it.</p>
              <Button
                variant="outline"
                className="mt-6 h-10 rounded-lg px-6"
                onClick={() => {
                  setSubmitted(false);
                  setName("");
                  setEmail("");
                  setRole("");
                  setRating(0);
                  setMessage("");
                }}
              >
                Submit another
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border py-7 shadow-none md:py-9">
            <CardContent>
              <form onSubmit={(e) => void handleSubmit(e)}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="fb-name" className="mb-1.5 text-navy">
                      Name
                    </Label>
                    <Input
                      id="fb-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="fb-email" className="mb-1.5 text-navy">
                      Email
                    </Label>
                    <Input
                      id="fb-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="h-10"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="fb-role" className="mb-1.5 text-navy">
                      Role
                    </Label>
                    <select
                      id="fb-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <option value="">Select your role…</option>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-5">
                  <Label className="mb-2 text-navy">Rating</Label>
                  <div className="flex gap-1.5" onMouseLeave={() => setHovered(0)}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHovered(star)}
                        aria-label={`${star} star${star > 1 ? "s" : ""}`}
                        className={`text-2xl transition-transform hover:scale-110 focus-visible:outline-none ${
                          star <= displayRating ? "text-primary" : "text-muted-foreground/40"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <Label htmlFor="fb-message" className="mb-1.5 text-navy">
                    Feedback <span className="text-destructive">*</span>
                  </Label>
                  <textarea
                    id="fb-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    placeholder="Share your thoughts, suggestions, or what you love about Layah..."
                    className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>

                {error ? (
                  <p className="mt-3 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 h-11 w-full rounded-lg text-sm font-semibold sm:w-auto sm:min-w-48"
                >
                  {submitting ? "Sending…" : "Send feedback"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </Container>
    </section>
  );
}
