"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, MailCheck } from "lucide-react";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-zinc-950 flex-col justify-between p-12 overflow-hidden">
        {/* Tile grid pattern */}
        <div className="login-tile-grid absolute inset-0 opacity-[0.06]" />
        {/* Decorative tile squares */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[8%] left-[12%] w-[120px] h-[120px] rotate-12 opacity-[0.08] rounded-xl border border-white" />
          <div className="absolute top-[18%] left-[62%] w-[80px] h-[80px] rotate-[-8deg] opacity-[0.06] rounded-xl border border-white" />
          <div className="absolute top-[52%] left-[6%] w-[90px] h-[90px] rotate-20 opacity-[0.07] rounded-xl border border-white" />
          <div className="absolute top-[62%] left-[55%] w-[140px] h-[140px] rotate-[-15deg] opacity-[0.05] rounded-xl border border-white" />
          <div className="absolute top-[80%] left-[28%] w-[70px] h-[70px] rotate-[5deg] opacity-[0.09] rounded-xl border border-white" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <Image src="/logo-192.png" alt="Tylio" width={36} height={36} className="rounded-lg" />
          <div>
            <p className="text-white font-bold text-lg leading-none">Tylio</p>
            <p className="text-white/40 text-xs mt-0.5">Stock Management</p>
          </div>
        </div>

        {/* Center copy */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Ceramic inventory,
              <br />
              <span className="text-white/50">under control.</span>
            </h1>
            <p className="text-white/40 text-base leading-relaxed max-w-sm">
              Track stock levels, record sales, and manage your entire ceramic
              catalog from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {["Real-time stock", "Sales tracking", "Brand catalog", "Role-based access"].map((f) => (
              <span
                key={f}
                className="text-xs text-white/50 border border-white/10 rounded-full px-3 py-1 bg-white/5"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="relative z-10 text-white/20 text-xs">
          © {new Date().getFullYear()} Tylio
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <Image src="/logo-192.png" alt="Tylio" width={32} height={32} className="rounded-md" />
            <span className="font-bold text-lg">Tylio</span>
          </div>

          {success ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-xl p-2.5">
                    <MailCheck className="size-5 text-primary" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Check your email</h2>
                <p className="text-muted-foreground text-sm">
                  We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
                </p>
              </div>
              <Button asChild size="lg" variant="outline" className="w-full">
                <Link href="/login">Back to Sign In</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Create an account</h2>
                <p className="text-muted-foreground text-sm">
                  Request access to start managing inventory.
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
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <PasswordInput
                    id="password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="h-10"
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
                >
                  {loading ? "Creating account…" : "Sign Up"}
                  {!loading && <ArrowRight className="size-4" />}
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
        </div>
      </div>
    </div>
  );
}
