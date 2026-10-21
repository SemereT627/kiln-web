"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";

const MIN_LENGTH = 8;

/**
 * Reached from an emailed invite / re-invite link via /api/auth/confirm,
 * which has already signed the user in. They pick a password here, then
 * continue to the dashboard.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <AuthShell>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Set your password</h2>
        <p className="text-muted-foreground text-sm">
          Your access was approved. Choose a password to finish setting up your
          account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            New password
          </Label>
          <PasswordInput
            id="password"
            placeholder={`At least ${MIN_LENGTH} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm" className="text-sm font-medium">
            Confirm password
          </Label>
          <PasswordInput
            id="confirm"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={MIN_LENGTH}
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
          aria-busy={loading}
        >
          {loading ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              <span className="sr-only">Saving password</span>
            </>
          ) : (
            <>
              Save and continue
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
