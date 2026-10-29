"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";

/**
 * "Request access" — submits a request for an admin to review. No account
 * is created here; approval does that and emails an invite link.
 */
export default function RequestAccessPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, message: message || null, website }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't submit your request");
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      {success ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="w-fit rounded-xl bg-primary/10 p-2.5">
              <MailCheck className="size-5 text-primary" />
            </div>
            <h2 className="font-display text-3xl font-medium tracking-[-0.015em]">Request sent</h2>
            <p className="text-muted-foreground text-sm">
              Thanks, {fullName.split(" ")[0] || "there"}. An administrator will
              review your request. We&apos;ll email{" "}
              <strong
                className="inline-block max-w-full truncate align-bottom text-foreground"
                title={email}
              >
                {email}
              </strong>{" "}
              once it&apos;s approved, with a link to set your password.
            </p>
          </div>
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-medium tracking-[-0.015em]">Request access</h2>
            <p className="text-muted-foreground text-sm">
              Tell us who you are. An administrator reviews every request.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">
                Full name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                maxLength={100}
                autoComplete="name"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message" className="text-sm font-medium">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="message"
                placeholder="e.g. I'm a new sales rep at the Bole branch."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>

            {/* Honeypot: off-screen and skipped by keyboard/screen readers */}
            <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/8 rounded-lg px-3 py-2.5 border border-destructive/15">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Sending request</span>
                </>
              ) : (
                <>
                  Send request
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-foreground font-semibold hover:underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
