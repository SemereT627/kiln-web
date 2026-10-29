"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Factor, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { formatDate, formatDateTime } from "@/lib/utils";

const MIN_PASSWORD = 8;
// Mirrors TIMEOUT_DURATION in hooks/use-session-timeout.ts.
const INACTIVITY_MINUTES = 30;

interface Profile {
  full_name: string | null;
  role: string;
  locale: string | null;
  created_at: string;
}

/** "Chrome on macOS" — enough to recognise the device, no UA library needed. */
function describeDevice(ua: string) {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "unknown OS";
  return { label: `${browser} on ${os}`, mobile: /iPhone|iPad|Android/.test(ua) };
}

/** Settings section: title + description on the left, controls on the right. */
function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-8">
      <div>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [aal, setAal] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [locale, setLocale] = useState("en-US");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [signOutOthersOpen, setSignOutOthersOpen] = useState(false);

  const loadFactors = useCallback(async () => {
    const [{ data: f }, { data: level }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setFactors(f?.totp.filter((x) => x.status === "verified") ?? []);
    setAal(level?.currentLevel ?? null);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
      const { data } = await supabase
        .from("user_profiles")
        .select("full_name, role, locale, created_at")
        .eq("id", user.id)
        .single();
      if (data) {
        setProfile(data);
        setFullName(data.full_name ?? "");
        setLocale(data.locale ?? "en-US");
      }
      await loadFactors();
    })();
  }, [supabase, loadFactors]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("user_profiles")
      .update({ full_name: fullName.trim(), locale })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function signOut(scope: "local" | "others") {
    const { error } = await supabase.auth.signOut({ scope });
    if (scope === "local") {
      window.location.assign("/login");
      return;
    }
    if (error) toast.error(error.message);
    else toast.success("Signed out of all other devices");
  }

  if (!user || !profile) return <ProfileSkeleton />;

  const name = fullName || user.email || "?";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const device = typeof navigator !== "undefined" ? describeDevice(navigator.userAgent) : null;
  const factor = factors[0];

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-8 animate-in fade-in duration-500">
      <PageHeader title="Profile" description="Your account, password, sign-in security and sessions." />

      {/* Account summary */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{profile.full_name || "Unnamed"}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Badge variant="secondary" className="capitalize">
            {profile.role}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Member since {formatDate(profile.created_at)}
          </span>
        </div>
      </div>

      <Section icon={UserRound} title="Personal info" description="How your name appears to the team, and your language.">
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email ?? ""} disabled readOnly />
            <p className="text-xs text-muted-foreground">Ask an administrator to change your email.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="locale">Language</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger id="locale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">English</SelectItem>
                <SelectItem value="am-ET">Amharic (አማርኛ)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={savingProfile}>
            {savingProfile && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </form>
      </Section>

      <Section icon={KeyRound} title="Password" description={`At least ${MIN_PASSWORD} characters. You stay signed in on this device.`}>
        <form onSubmit={savePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <PasswordInput
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" disabled={savingPassword}>
            {savingPassword && <Loader2 className="size-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </Section>

      <Section
        icon={ShieldCheck}
        title="Two-step sign-in"
        description="Required for the web dashboard. You enter a code from your authenticator app after your password."
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3 rounded-lg border p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">Authenticator app</span>
                <Badge className="bg-success/10 text-success hover:bg-success/10">On</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {factor
                  ? `Added ${formatDate(factor.created_at)}`
                  : "Set up when you signed in."}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setReplaceOpen(true)}>
              Replace
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            New phone? Use Replace while you still have the old one. If you&apos;ve lost it,
            an administrator can reset your two-step sign-in from the Users page.
          </p>
        </div>
      </Section>

      <Section icon={Laptop} title="Sessions" description="Where you're signed in, and how to end those sessions.">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {device?.mobile ? <Smartphone className="size-4" /> : <Laptop className="size-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{device?.label ?? "This device"}</span>
                <Badge variant="outline">This device</Badge>
              </div>
              <dl className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
                {user.last_sign_in_at && (
                  <div>Signed in {formatDateTime(user.last_sign_in_at)}</div>
                )}
                <div>
                  {aal === "aal2" ? "Verified with your authenticator" : "Not yet verified with your authenticator"}
                </div>
                <div>Signs out automatically after {INACTIVITY_MINUTES} minutes of inactivity</div>
              </dl>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSignOutOthersOpen(true)}>
              Sign out other devices
            </Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => signOut("local")}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Signing out other devices also signs you out of the Kiln mobile app.
          </p>
        </div>
      </Section>

      <ConfirmDialog
        open={signOutOthersOpen}
        onOpenChange={setSignOutOthersOpen}
        title="Sign out of all other devices?"
        description="Every other browser and the mobile app will need to sign in again. You stay signed in here."
        confirmLabel="Sign out others"
        onConfirm={() => signOut("others")}
      />

      {/* Mounted only while open, so each attempt starts a fresh enrolment */}
      {replaceOpen && (
        <ReplaceAuthenticatorDialog
          onOpenChange={setReplaceOpen}
          oldFactorIds={factors.map((f) => f.id)}
          onReplaced={loadFactors}
        />
      )}
    </div>
  );
}

/**
 * Enrol a new TOTP factor, confirm it with a code, then remove the old one —
 * the account is never left without a working authenticator.
 */
function ReplaceAuthenticatorDialog({
  onOpenChange,
  oldFactorIds,
  onReplaced,
}: {
  onOpenChange: (open: boolean) => void;
  oldFactorIds: string[];
  onReplaced: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [enrolment, setEnrolment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Strict Mode runs effects twice in dev; enrol only once per open.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        // Friendly names must be unique per user.
        friendlyName: `Kiln ${new Date().toISOString()}`,
        issuer: "Kiln",
      });
      if (error || !data) {
        setError(error?.message ?? "Couldn't start setup.");
        return;
      }
      setEnrolment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, [supabase]);

  async function close(nextOpen: boolean) {
    // Abandoned before confirming: drop the unverified factor.
    if (!nextOpen && enrolment && !busy) {
      await supabase.auth.mfa.unenroll({ factorId: enrolment.id });
    }
    onOpenChange(nextOpen);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolment) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolment.id,
      code: code.trim(),
    });
    if (error) {
      setError("That code didn't work. Check the new entry in your authenticator app.");
      setCode("");
      setBusy(false);
      return;
    }
    for (const id of oldFactorIds) {
      await supabase.auth.mfa.unenroll({ factorId: id });
    }
    setBusy(false);
    toast.success("Authenticator replaced");
    onReplaced();
    onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Replace authenticator</DialogTitle>
          <DialogDescription>
            Scan this with the authenticator app on your new phone, then enter the code it shows.
            Your old authenticator stops working once this is confirmed.
          </DialogDescription>
        </DialogHeader>

        {!enrolment && !error && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        )}

        {enrolment && (
          <form onSubmit={confirm} className="space-y-4">
            {/* QR code is an SVG data URL generated by Supabase, not a product image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrolment.qr} alt="QR code for your authenticator app" className="mx-auto size-40 rounded-lg bg-white p-2" />
            <p className="text-center text-xs text-muted-foreground">
              Can&apos;t scan? Enter this key:
              <span className="mt-1 block font-mono text-sm tracking-wider text-foreground break-all select-all">
                {enrolment.secret}
              </span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="newCode">6-digit code</Label>
              <Input
                id="newCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-11 text-center font-mono text-lg tracking-[0.4em]"
                autoFocus
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Confirm and replace
              </Button>
            </DialogFooter>
          </form>
        )}

        {!enrolment && error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-8">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-24 rounded-xl" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-48 rounded-xl" />
      ))}
    </div>
  );
}
